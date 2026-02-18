<template>
  <div class="md:p-4 border-b mb-4">
    <h1 class="text-3xl font-semibold mb-4 sm:text-4xl break-words">{{ act.actTitle ?? `Act ${act.actNumber}` }}<span v-if="act.title">: {{ act.title }}</span></h1>
    <div v-for="scene in act.scenes" :key="scene.id" class="mb-4" v-show="scene.active">
      <SceneDisplay :scene="scene" :hide-to-check="hideToCheck" @play-from="$emit('play-from', $event)"/>
    </div>
  </div>
</template>

<script>
import SceneDisplay from './SceneDisplay.vue';

export default {
  name: 'ActDisplay',
  components: {
    SceneDisplay
  },
  emits: ['play-from'],
  props: {
    act: {
      type: Object,
      required: true
    },
    hideToCheck: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>
/* Add your styles here */
</style>
