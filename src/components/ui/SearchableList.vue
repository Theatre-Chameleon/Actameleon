<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
    // items: [{ id, label, count?, checked }]
  },
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  title: {
    type: String,
    default: ''
  },
  showCounts: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['change', 'reset']);

const searchQuery = ref('');

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return props.items;
  const query = searchQuery.value.toLowerCase();
  return props.items.filter(item => 
    item.label.toLowerCase().includes(query)
  );
});

const selectedCount = computed(() => 
  props.items.filter(item => item.checked).length
);

const toggleItem = (item) => {
  emit('change', item.id, !item.checked);
};

const resetSelection = () => {
  emit('reset');
  searchQuery.value = '';
};
</script>

<template>
  <div class="searchable-list">
    <div class="searchable-list-sticky">
      <div class="searchable-list-header">
        <span class="searchable-list-title">
          {{ title }}
          <span v-if="selectedCount > 0" class="selected-badge">({{ selectedCount }} selected)</span>
        </span>
        <button
          v-if="selectedCount > 0"
          @click="resetSelection"
          class="reset-button"
        >
          Reset
        </button>
      </div>

      <div class="search-input-wrapper">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="search-input"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="clear-search"
          aria-label="Clear search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="list-container">
      <div v-if="filteredItems.length === 0" class="empty-state">
        No results found
      </div>
      <label 
        v-for="item in filteredItems" 
        :key="item.id"
        class="list-item"
      >
        <input 
          type="checkbox"
          :checked="item.checked"
          @change="toggleItem(item)"
          class="item-checkbox"
        />
        <span class="item-label">
          <slot name="label" :item="item">{{ item.label }}</slot>
        </span>
        <span v-if="showCounts && item.count !== undefined" class="item-count">
          {{ item.count }}
        </span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.searchable-list {
  @apply flex flex-col;
}

/* Header + search stay pinned: the sheet body is the only scroller now */
.searchable-list-sticky {
  @apply sticky top-0 z-10 bg-white dark:bg-gray-900;
}

.searchable-list-header {
  @apply flex items-center justify-between px-4 py-2;
}

.searchable-list-title {
  @apply text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide;
}

.selected-badge {
  @apply text-blue-500 normal-case;
}

.reset-button {
  @apply text-sm text-blue-500 hover:text-blue-700;
  @apply p-0 bg-transparent border-none;
}

.search-input-wrapper {
  @apply relative mx-4 mb-2;
}

.search-icon {
  @apply absolute left-3 top-1/2 -translate-y-1/2 text-gray-400;
}

.search-input {
  @apply w-full pl-10 pr-10 py-2.5 rounded-lg border;
  @apply bg-gray-50 dark:bg-gray-800;
  @apply border-gray-200 dark:border-gray-700;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.clear-search {
  @apply absolute right-3 top-1/2 -translate-y-1/2;
  @apply text-gray-400 hover:text-gray-600;
  @apply p-0 bg-transparent border-none leading-none;
}

.list-container {
  @apply flex flex-col;
}

.empty-state {
  @apply px-4 py-8 text-center text-gray-500;
}

.list-item {
  @apply flex items-center gap-3 px-4 py-3 cursor-pointer;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800;
  @apply border-b dark:border-gray-800 last:border-b-0;
}

.item-checkbox {
  @apply w-5 h-5 rounded border-gray-300 dark:border-gray-600;
  @apply text-blue-500 focus:ring-blue-500;
}

.item-label {
  @apply flex-1 truncate;
}

.item-count {
  @apply text-sm text-gray-400 tabular-nums;
}
</style>
