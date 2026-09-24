<script setup>
import { computed } from 'vue';

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  script: {
    type: Object,
    default: () => ({})
  },
  actorColors: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['open-sheet', 'remove-actor', 'remove-scene']);

const colorFor = (actor) => props.actorColors?.[actor] || null;

// Get display name for actor
const getActorName = (actor) => {
  if (!actor || actor === 'undefined') return 'Stage Directions';
  return actor;
};

// Get scene title
const getSceneTitle = (sceneNumber) => {
  if (!props.script.acts) return `Scene ${sceneNumber}`;
  for (const act of props.script.acts) {
    const scene = act.scenes.find(s => s.sceneNumber === sceneNumber);
    if (scene) {
      return scene.sceneTitle || `Scene ${sceneNumber}`;
    }
  }
  return `Scene ${sceneNumber}`;
};

// Count active filters
const activeFilterCount = computed(() => {
  let count = 0;
  count += props.config.selectedActors?.length || 0;
  count += props.config.selectedScenes?.length || 0;
  if (props.config.showLinesPrior) count++;
  if (props.config.hideText) count++;
  if (props.config.highlightOnly) count++;
  if (props.config.colorActors) count++;
  return count;
});

const hasFilters = computed(() => activeFilterCount.value > 0);

// Limit displayed pills
const maxVisibleActors = 3;
const maxVisibleScenes = 2;

const visibleActors = computed(() => 
  props.config.selectedActors?.slice(0, maxVisibleActors) || []
);

const hiddenActorCount = computed(() => 
  Math.max(0, (props.config.selectedActors?.length || 0) - maxVisibleActors)
);

const visibleScenes = computed(() => 
  props.config.selectedScenes?.slice(0, maxVisibleScenes) || []
);

const hiddenSceneCount = computed(() => 
  Math.max(0, (props.config.selectedScenes?.length || 0) - maxVisibleScenes)
);

const removeActor = (actor, event) => {
  event.stopPropagation();
  emit('remove-actor', actor);
};

const removeScene = (sceneNumber, event) => {
  event.stopPropagation();
  emit('remove-scene', sceneNumber);
};

const openSheet = () => {
  emit('open-sheet');
};
</script>

<template>
  <button @click="openSheet" class="active-filters-bar">
    <div class="filters-label">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      <span>Filters</span>
      <span v-if="hasFilters" class="filter-count">{{ activeFilterCount }}</span>
    </div>
    
    <div v-if="hasFilters" class="pills-container">
      <!-- Actor pills -->
      <span 
        v-for="actor in visibleActors" 
        :key="actor"
        class="filter-pill"
        :class="colorFor(actor) ? 'filter-pill-actor-colored' : 'filter-pill-actor'"
        :style="colorFor(actor) && {
          '--actor-color-light': colorFor(actor).light,
          '--actor-color-dark': colorFor(actor).dark
        }"
      >
        <span class="pill-text" :class="{ 'actor-color': colorFor(actor) }">{{ getActorName(actor) }}</span>
        <button @click="removeActor(actor, $event)" class="pill-remove" aria-label="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
      
      <span v-if="hiddenActorCount > 0" class="filter-pill filter-pill-more">
        +{{ hiddenActorCount }} more
      </span>
      
      <!-- Scene pills -->
      <span 
        v-for="sceneNumber in visibleScenes" 
        :key="sceneNumber"
        class="filter-pill filter-pill-scene"
      >
        <span class="pill-text">{{ getSceneTitle(sceneNumber) }}</span>
        <button @click="removeScene(sceneNumber, $event)" class="pill-remove" aria-label="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
      
      <span v-if="hiddenSceneCount > 0" class="filter-pill filter-pill-more">
        +{{ hiddenSceneCount }} scenes
      </span>
      
      <!-- Option pills (no remove button, just indicators) -->
      <span v-if="config.showLinesPrior" class="filter-pill filter-pill-option">
        Cue lines
      </span>
      <span v-if="config.hideText" class="filter-pill filter-pill-option">
        Self-test
      </span>
      <span v-if="config.highlightOnly" class="filter-pill filter-pill-option">
        Highlight
      </span>
      <span v-if="config.colorActors" class="filter-pill filter-pill-option">
        Colours
      </span>
    </div>
    
    <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
</template>

<style scoped>
.active-filters-bar {
  @apply w-full flex items-center gap-2 p-3 mb-4;
  @apply bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700;
  @apply cursor-pointer text-left;
  @apply hover:border-blue-300 dark:hover:border-blue-600;
  @apply transition-colors;
}

.filters-label {
  @apply flex items-center gap-2 text-gray-600 dark:text-gray-400;
  @apply flex-shrink-0;
}

.filter-count {
  @apply w-5 h-5 rounded-full bg-blue-500 text-white text-xs;
  @apply flex items-center justify-center;
}

.pills-container {
  @apply flex-1 flex items-center gap-2 overflow-x-auto;
  @apply -my-1 py-1;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pills-container::-webkit-scrollbar {
  display: none;
}

.filter-pill {
  @apply flex items-center gap-1 px-2.5 py-1 rounded-full text-sm whitespace-nowrap;
  @apply flex-shrink-0;
}

/* Colour coding replaces the blue tint with a neutral one: the palette is
   verified for contrast against gray-100/gray-800, not against the blue. */
.filter-pill-actor-colored {
  @apply bg-gray-100 dark:bg-gray-800;
}

.filter-pill-actor {
  @apply bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300;
}

.filter-pill-scene {
  @apply bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300;
}

.filter-pill-option {
  @apply bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300;
}

.filter-pill-more {
  @apply bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400;
}

.pill-text {
  @apply max-w-24 truncate;
}

.pill-remove {
  @apply w-4 h-4 rounded-full flex items-center justify-center;
  @apply hover:bg-black/10 dark:hover:bg-white/10;
  @apply transition-colors;
}

.chevron {
  @apply text-gray-400 flex-shrink-0;
}
</style>
