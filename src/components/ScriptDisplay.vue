<template>
  <div class="md:p-4">
    <h1 class="text-4xl font-bold mb-4 break-words">{{ script.title }}</h1>
    <div v-for="act in script.acts" :key="act.actNumber" class="mb-6" v-show="act.active">
      <ActDisplay :act="act" :hide-to-check="hideToCheck" @play-from="$emit('play-from', $event)"/>
    </div>
  </div>
</template>

<script>
import ActDisplay from './ActDisplay.vue';

export default {
  name: 'ScriptDisplay',
  components: {
    ActDisplay
  },
  emits: ['play-from'],
  props: {
    script: {
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
