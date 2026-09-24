<template>
  <div
    class="scene p-4 border rounded-lg mb-4 sm:p-6 md:p-8 lg:p-10 xl:p-12"
    :class="{ 'scene-colored': actorColors }"
    :data-scene="scene.sceneNumber"
  >
    <!-- The cast row lives inside this header rather than beside the lines:
         row striping keys off .scene > :nth-child(even), so an extra direct
         child would flip the stripes of every line in the scene. -->
    <div class="mb-2">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold sm:text-3xl break-words">{{ scene.sceneTitle ?? `Scene ${scene.sceneNumber}` }}<span v-if="scene.title">: {{ scene.title }}</span></h2>
        <button v-if="hasPlayableLines" @click="$emit('play-from', scene.sceneNumber)" class="play-from-btn" title="Play from here">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
      <div v-if="cast.length" class="scene-cast">
        <span
          v-for="[actor, count] in cast"
          :key="actor"
          class="cast-pill"
          :style="colorFor(actor) && {
            '--actor-color-light': colorFor(actor).light,
            '--actor-color-dark': colorFor(actor).dark
          }"
        >
          <span :class="{ 'actor-color': colorFor(actor) }">{{ actor }}</span>
          <span class="cast-pill-count">{{ count }}</span>
        </span>
      </div>
    </div>
    <div v-if="scene.setting" class="italic mb-2">{{ scene.setting }}</div>
    <LineDisplay v-for="(line, index) in scene.lines" :key="`${scene.sceneNumber}-${index}`" :line="line" :line-id="`line-${scene.sceneNumber}-${index}`" :hide-to-check="hideToCheck" :actor-colors="actorColors"/>
  </div>
</template>

<script>
import LineDisplay from './LineDisplay.vue';
import { sceneCast } from '../services/actorColor.js';

export default {
  name: 'SceneDisplay',
  components: {
    LineDisplay
  },
  emits: ['play-from'],
  props: {
    scene: {
      type: Object,
      required: true
    },
    hideToCheck: {
      type: Boolean,
      default: false
    },
    actorColors: {
      type: Object,
      default: null
    }
  },
  computed: {
    // Same rule as the actor filter list, scoped to this scene: busiest first,
    // ties by name, stage directions left out.
    cast() {
      return sceneCast(this.scene);
    },
    hasPlayableLines() {
      return this.scene.lines.some(line =>
        line.state === 'show' || line.state === 'clue' || line.state === 'highlight'
      );
    }
  },
  methods: {
    colorFor(actor) {
      return this.actorColors?.[actor] || null;
    }
  }
}
</script>

<style scoped>
.scene-cast {
  @apply flex flex-wrap items-center gap-1.5 mt-2;
}

/* Names are not truncated: a clipped character name defeats the point of the
   row. A long name just takes a wider pill and the row wraps. */
.cast-pill {
  @apply inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full;
  @apply text-xs font-medium;
  @apply bg-gray-100 dark:bg-gray-800;
}

.cast-pill-count {
  @apply text-gray-500 dark:text-gray-400 tabular-nums font-normal;
}

.play-from-btn {
  @apply p-2 rounded-full text-green-500 hover:text-green-600;
  @apply hover:bg-green-50 dark:hover:bg-green-900/30;
  @apply transition-colors flex-shrink-0;
}
</style>
