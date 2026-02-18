<template>
  <div class="scene p-4 border rounded-lg mb-4 sm:p-6 md:p-8 lg:p-10 xl:p-12" :data-scene="scene.sceneNumber">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-2xl font-semibold sm:text-3xl break-words">{{ scene.sceneTitle ?? `Scene ${scene.sceneNumber}` }}<span v-if="scene.title">: {{ scene.title }}</span></h2>
      <button v-if="hasPlayableLines" @click="$emit('play-from', scene.sceneNumber)" class="play-from-btn" title="Play from here">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    </div>
    <div v-if="scene.setting" class="italic mb-2">{{ scene.setting }}</div>
    <LineDisplay v-for="(line, index) in scene.lines" :key="`${scene.sceneNumber}-${index}`" :line="line" :line-id="`line-${scene.sceneNumber}-${index}`" :hide-to-check="hideToCheck"/>
  </div>
</template>

<script>
import LineDisplay from './LineDisplay.vue';

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
    }
  },
  computed: {
    hasPlayableLines() {
      return this.scene.lines.some(line =>
        line.state === 'show' || line.state === 'clue' || line.state === 'highlight'
      );
    }
  }
}
</script>

<style scoped>
.play-from-btn {
  @apply p-2 rounded-full text-green-500 hover:text-green-600;
  @apply hover:bg-green-50 dark:hover:bg-green-900/30;
  @apply transition-colors flex-shrink-0;
}
</style>
