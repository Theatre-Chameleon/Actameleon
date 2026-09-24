<template>
  <div
    :class="[`line-${line.state}`, { 'line-selected': line.selected, 'line-colored': actorColor, 'line-mine': line.mine }]"
    :style="actorColor && { '--actor-color-light': actorColor.light, '--actor-color-dark': actorColor.dark }"
    :data-line-id="lineId"
  >
    <strong
      v-if="line.actor && line.state != 'hide'"
      class="mr-2"
      :class="{ 'actor-color': actorColor }"
    >{{ line.actor }}:</strong>
    <span v-if="line.setting && line.state != 'hide' && !hideText" class="italic mr-2">{{ line.setting }}</span>
    <span v-if="line.state!='hide' && !hideText"><template v-if="cueSplit">{{ cueSplit.lead }}<span class="cue-tail">{{ cueSplit.tail }}</span>{{ cueSplit.after }}</template><template v-else>{{ line.text }}</template></span>
    <button v-if="line.state!='hide' && !hideText && hideToCheck && (line.state == 'show' || line.state == 'highlight')" @click="toggleHideText" class="hide-text-button">Hide</button>
    <button v-if="line.state!='hide' && line.state!='highlight' && hideText" @click="toggleHideText" class="show-text-button">Show</button>
    <button v-if="line.state=='highlight' && hideText" @click="toggleHideText" class="show-text-button">Show</button>
    <span v-if="line.state=='hide'" :class="{ 'actor-color': actorColor }">*</span>
  </div>
</template>

<script>
import { splitCueTail } from '../services/cueTail.js';

export default {
  name: 'LineDisplay',
  props: {
    line: {
      type: Object,
      required: true
    },
    lineId: {
      type: String,
      required: true
    },
    hideToCheck: {
      type: Boolean,
      default: false
    },
    actorColors: {
      // { [actor]: { light, dark } }, or null when colour coding is off
      type: Object,
      default: null
    }
  },
  data() {
    return {
      hideText: this.hideToCheck && (this.line.state == 'show' || this.line.state == 'highlight')
    }
  },
  computed: {
    actorColor() {
      return this.actorColors?.[this.line.actor] || null;
    },
    // Only with colour coding on: without it cues keep their original look.
    cueSplit() {
      if (!this.actorColor || this.line.state !== 'clue') return null;
      return splitCueTail(this.line.text);
    }
  },
  watch: {
    hideToCheck(newVal) {
      this.hideText = newVal && (this.line.state == 'show' || this.line.state == 'highlight');
    }
  },
  methods: {
    toggleHideText() {
      this.hideText = !this.hideText;
    }
  }
}
</script>

<style scoped>
.hide-text-button {
  @apply ml-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
  @apply transition-colors;
}
</style>
