<script setup>
import { computed, ref } from 'vue';
import { hueChoices } from '../services/actorColor.js';
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
  },
  actorColors: {
    type: Object,
    default: null
  }
});

const colorFor = (actorId) => props.actorColors?.[actorId] || null;

const pickerFor = ref(null);
const togglePicker = (actorId) => {
  pickerFor.value = pickerFor.value === actorId ? null : actorId;
};

const choices = hueChoices();

const overrides = () => props.config.actorHueOverrides || (props.config.actorHueOverrides = {});

const setColor = (actorId, index) => {
  overrides()[actorId] = index;
  pickerFor.value = null;
};

const clearColor = (actorId) => {
  delete overrides()[actorId];
  pickerFor.value = null;
};

defineEmits(['close']);

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
  
  // Same order as the colour ranking in actorColor.js, including the name
  // tiebreak, so a row's swatch matches the colour that rank hands out.
  return Object.entries(actorCounts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
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
      >
        <template #label="{ item }">
          <span
            :class="{ 'actor-color': colorFor(item.id) }"
            :style="colorFor(item.id) && {
              '--actor-color-light': colorFor(item.id).light,
              '--actor-color-dark': colorFor(item.id).dark
            }"
          >{{ item.label }}</span>
        </template>

        <template #trailing="{ item }">
          <button
            v-if="colorFor(item.id)"
            class="swatch"
            :class="{ 'swatch-open': pickerFor === item.id }"
            :style="{ '--swatch-light': colorFor(item.id).light, '--swatch-dark': colorFor(item.id).dark }"
            :aria-label="`Change colour for ${item.label}`"
            :aria-expanded="pickerFor === item.id"
            @click.stop.prevent="togglePicker(item.id)"
          />
        </template>

        <template #after="{ item }">
          <div v-if="pickerFor === item.id" class="picker">
            <button
              v-for="choice in choices"
              :key="choice.index"
              class="picker-swatch"
              :class="{ 'picker-swatch-current': colorFor(item.id)?.hueIndex === choice.index }"
              :style="{ '--swatch-light': choice.light, '--swatch-dark': choice.dark }"
              :aria-label="`Colour ${choice.index + 1} of ${choices.length}`"
              @click.stop.prevent="setColor(item.id, choice.index)"
            />
            <button class="picker-reset" @click.stop.prevent="clearColor(item.id)">Default</button>
          </div>
        </template>
      </SearchableList>
      
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
        <div class="options-header">
          <span class="section-title">Options</span>
        </div>
        
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
            Colour actor names
            <span class="option-hint">Give every character its own colour</span>
          </span>
          <button
            @click="config.colorActors = !config.colorActors"
            :class="['toggle-btn', { 'toggle-btn-active': config.colorActors }]"
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

/* The row is a <label>, so the swatch must swallow its own click or it would
   toggle the actor's checkbox as well. */
.swatch {
  @apply w-5 h-5 rounded shrink-0 p-0;
  @apply border border-black/20 dark:border-white/25;
  background: var(--swatch-light);
}

.swatch-open {
  @apply ring-2 ring-blue-500;
}

/* Expanded inline rather than floated: the sheet is a max-height scroller and
   an absolutely positioned popover would be clipped by it. */
.picker {
  @apply flex flex-wrap gap-2 px-4 py-3 items-center;
  @apply bg-gray-50 dark:bg-gray-800/60 border-b dark:border-gray-800;
}

.picker-swatch {
  @apply w-7 h-7 rounded shrink-0 p-0;
  @apply border border-black/20 dark:border-white/25;
  background: var(--swatch-light);
}

.picker-swatch-current {
  @apply ring-2 ring-blue-500;
}

.picker-reset {
  @apply text-sm text-blue-500 hover:text-blue-700;
  @apply p-0 bg-transparent border-none ml-1;
}

.section-divider {
  @apply h-2 bg-gray-100 dark:bg-gray-800;
}

.acts-section {
  @apply py-2;
}

.acts-header {
  @apply flex items-center justify-between px-4 py-2;
  @apply sticky top-0 z-10 bg-white dark:bg-gray-900;
}

.section-title {
  @apply text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide;
}

.reset-button {
  @apply text-sm text-blue-500 hover:text-blue-700;
  @apply p-0 bg-transparent border-none;
}

.acts-list {
  @apply flex flex-col;
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

.options-header {
  @apply px-4 py-2;
  @apply sticky top-0 z-10 bg-white dark:bg-gray-900;
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
  @apply relative w-12 h-7 rounded-full flex-shrink-0;
  @apply bg-gray-300 dark:bg-gray-600;
  @apply p-0 border-none;
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

/* Swatches carry both variants; pick one per theme the same way actor names do. */
@media (prefers-color-scheme: dark) {
  .swatch,
  .picker-swatch {
    background: var(--swatch-dark);
  }
}
</style>
