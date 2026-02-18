<script setup>
import { computed } from 'vue';
import BottomSheet from './ui/BottomSheet.vue';
import SearchableList from './ui/SearchableList.vue';
import CollapsibleSection from './ui/CollapsibleSection.vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  script: {
    type: Object,
    required: true
  },
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

// Build actors list with line counts
const actorItems = computed(() => {
  if (!props.script.acts) return [];
  
  const actorCounts = {};
  props.script.acts.forEach(act => {
    act.scenes.forEach(scene => {
      scene.lines.forEach(line => {
        const actor = line.actor;
        actorCounts[actor] = (actorCounts[actor] || 0) + 1;
      });
    });
  });
  
  return Object.entries(actorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([actor, count]) => ({
      id: actor,
      label: (!actor || actor === 'undefined') ? 'Stage Directions' : actor,
      count,
      checked: props.config.selectedActors.includes(actor)
    }));
});

// Build acts with their scenes
const actsWithScenes = computed(() => {
  if (!props.script.acts) return [];
  
  return props.script.acts.map(act => {
    const scenes = act.scenes.map(scene => ({
      sceneNumber: scene.sceneNumber,
      title: scene.sceneTitle || `Scene ${scene.sceneNumber}`,
      checked: props.config.selectedScenes.length === 0 || 
               props.config.selectedScenes.includes(scene.sceneNumber)
    }));
    
    const selectedCount = scenes.filter(s => 
      props.config.selectedScenes.includes(s.sceneNumber)
    ).length;
    
    return {
      actNumber: act.actNumber,
      title: act.actTitle || `Act ${act.actNumber}`,
      scenes,
      selectedCount,
      totalCount: scenes.length
    };
  });
});

// Actor selection handlers
const onActorChange = (actorId, checked) => {
  const index = props.config.selectedActors.indexOf(actorId);
  if (checked && index === -1) {
    props.config.selectedActors.push(actorId);
  } else if (!checked && index > -1) {
    props.config.selectedActors.splice(index, 1);
  }
};

const resetActors = () => {
  props.config.selectedActors.splice(0, props.config.selectedActors.length);
};

// Scene selection handlers
const toggleScene = (sceneNumber) => {
  const index = props.config.selectedScenes.indexOf(sceneNumber);
  if (index > -1) {
    props.config.selectedScenes.splice(index, 1);
  } else {
    props.config.selectedScenes.push(sceneNumber);
  }
};

const toggleAllScenesInAct = (act, selectAll) => {
  const sceneNumbers = act.scenes.map(s => s.sceneNumber);
  
  if (selectAll) {
    // Add all scenes from this act that aren't already selected
    sceneNumbers.forEach(sn => {
      if (!props.config.selectedScenes.includes(sn)) {
        props.config.selectedScenes.push(sn);
      }
    });
  } else {
    // Remove all scenes from this act
    sceneNumbers.forEach(sn => {
      const index = props.config.selectedScenes.indexOf(sn);
      if (index > -1) {
        props.config.selectedScenes.splice(index, 1);
      }
    });
  }
};

const resetScenesAndActs = () => {
  props.config.selectedScenes.splice(0, props.config.selectedScenes.length);
  props.config.selectedActs.splice(0, props.config.selectedActs.length);
};

const hasSceneSelection = computed(() => props.config.selectedScenes.length > 0);

// Check if a scene is selected (when no selection = all visible)
const isSceneSelected = (sceneNumber) => {
  return props.config.selectedScenes.includes(sceneNumber);
};

// Skip speed: maps slider position to ms-per-char multiplier
const speedValues = [0.5, 1, 2]; // fast, medium, slow
const speedIndex = computed(() => {
  const val = props.config.skipSpeed ?? 1;
  const idx = speedValues.indexOf(val);
  return idx >= 0 ? idx : 1;
});
</script>

<template>
  <BottomSheet :open="open" title="Filters" @close="$emit('close')">
    <div class="filter-sheet-content">
      <!-- Actors Section -->
      <SearchableList
        :items="actorItems"
        title="Actors"
        search-placeholder="Search actors..."
        @change="onActorChange"
        @reset="resetActors"
      />
      
      <!-- Acts & Scenes Section -->
      <div class="section-divider"></div>
      <div class="acts-section">
        <div class="acts-header">
          <span class="section-title">Acts & Scenes</span>
          <button 
            v-if="hasSceneSelection" 
            @click="resetScenesAndActs" 
            class="reset-button"
          >
            Reset
          </button>
        </div>
        
        <div class="acts-list">
          <CollapsibleSection
            v-for="act in actsWithScenes"
            :key="act.actNumber"
            :title="act.title"
            :selected-count="act.selectedCount"
            :total-count="act.totalCount"
            @toggle-all="(selectAll) => toggleAllScenesInAct(act, selectAll)"
          >
            <label 
              v-for="scene in act.scenes" 
              :key="scene.sceneNumber"
              class="scene-item"
            >
              <input 
                type="checkbox"
                :checked="isSceneSelected(scene.sceneNumber)"
                @change="toggleScene(scene.sceneNumber)"
                class="scene-checkbox"
              />
              <span>{{ scene.title }}</span>
            </label>
          </CollapsibleSection>
        </div>
      </div>
      
      <!-- Options Section -->
      <div class="section-divider"></div>
      <div class="options-section">
        <div class="section-title px-4 py-2">Options</div>
        
        <label class="option-row">
          <span class="option-label">Show cue lines</span>
          <button 
            @click="config.showLinesPrior = !config.showLinesPrior"
            :class="['toggle-btn', { 'toggle-btn-active': config.showLinesPrior }]"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        
        <label class="option-row">
          <span class="option-label">Hide text (self-test)</span>
          <button 
            @click="config.hideText = !config.hideText"
            :class="['toggle-btn', { 'toggle-btn-active': config.hideText }]"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>
        
        <label class="option-row">
          <span class="option-label">
            Highlight only
            <span class="option-hint">Show all lines, highlight selected actors</span>
          </span>
          <button
            @click="config.highlightOnly = !config.highlightOnly"
            :class="['toggle-btn', { 'toggle-btn-active': config.highlightOnly }]"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>

        <label class="option-row">
          <span class="option-label">
            Skip my lines in TTS
            <span class="option-hint">Only speak other actors' lines during playback</span>
          </span>
          <button
            @click="config.skipMyLines = !config.skipMyLines"
            :class="['toggle-btn', { 'toggle-btn-active': config.skipMyLines }]"
          >
            <span class="toggle-knob"></span>
          </button>
        </label>

        <div v-if="config.skipMyLines" class="speed-slider">
          <span class="option-label">
            Pause speed
            <span class="option-hint">How much time to speak your lines</span>
          </span>
          <div class="slider-row">
            <span class="slider-label">Fast</span>
            <input
              type="range"
              min="0" max="2" step="1"
              :value="speedIndex"
              @input="config.skipSpeed = speedValues[$event.target.value]"
              class="slider-input"
            />
            <span class="slider-label">Slow</span>
          </div>
        </div>
      </div>
      
      <!-- Bottom padding for safe area -->
      <div class="safe-area-spacer"></div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.filter-sheet-content {
  @apply pb-4;
}

.section-divider {
  @apply h-2 bg-gray-100 dark:bg-gray-800;
}

.acts-section {
  @apply py-2;
}

.acts-header {
  @apply flex items-center justify-between px-4 py-2;
}

.section-title {
  @apply text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide;
}

.reset-button {
  @apply text-sm text-blue-500 hover:text-blue-700;
}

.acts-list {
  @apply max-h-64 overflow-y-auto;
}

.scene-item {
  @apply flex items-center gap-3 py-2 cursor-pointer;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800;
}

.scene-checkbox {
  @apply w-5 h-5 rounded border-gray-300 dark:border-gray-600;
  @apply text-blue-500 focus:ring-blue-500;
}

.options-section {
  @apply py-2;
}

.option-row {
  @apply flex items-center justify-between px-4 py-3;
  @apply cursor-pointer;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800;
}

.option-label {
  @apply flex flex-col;
}

.option-hint {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.toggle-btn {
  @apply relative w-12 h-7 rounded-full;
  @apply bg-gray-300 dark:bg-gray-600;
  @apply transition-colors duration-200;
}

.toggle-btn-active {
  @apply bg-blue-500;
}

.toggle-knob {
  @apply absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow;
  @apply transition-transform duration-200;
}

.toggle-btn-active .toggle-knob {
  @apply translate-x-5;
}

.speed-slider {
  @apply px-4 py-3;
}

.slider-row {
  @apply flex items-center gap-3 mt-2;
}

.slider-label {
  @apply text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap;
}

.slider-input {
  @apply w-full h-2 rounded-full appearance-none cursor-pointer;
  @apply bg-gray-300 dark:bg-gray-600;
  accent-color: theme('colors.blue.500');
}

.safe-area-spacer {
  @apply h-8;
}
</style>
