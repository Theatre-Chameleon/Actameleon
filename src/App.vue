<script setup>
import { ref, reactive, watch, computed } from 'vue';
import ScriptDisplay from './components/ScriptDisplay.vue';
import SceneNav from './components/SceneNav.vue';
import ScriptSelector from './components/ScriptSelector.vue';
import FilterSheet from './components/FilterSheet.vue';
import ActiveFilters from './components/ActiveFilters.vue';
import scripts from './assets/scripts.json';
import t2v from './services/text2voice.js';

const safeJSONparse = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

const selectedScript = ref(safeJSONparse(localStorage.getItem('script')) || 'fools');

const config = reactive(safeJSONparse(localStorage.getItem(`config.${selectedScript.value}`)) 
                  || {
                    selectedActors: [],
                    selectedActs: [],
                    selectedScenes: [],
                    showLinesPrior: false,
                    hideText: false,
                    highlightOnly: false,
                    skipMyLines: false,
                    skipSpeed: 1
                  });

// Modal states
const showScriptSelector = ref(false);
const showFilterSheet = ref(false);

const markActive = (script) => {
  if (!script.acts) return script;
  
  script.acts.forEach(act => {
    act.active = config.selectedActs.length == 0 ? true : config.selectedActs.includes(act.actNumber);
    act.scenes.forEach(scene => {
      scene.active = config.selectedScenes.length == 0 ? true : config.selectedScenes.includes(scene.sceneNumber);

      for (let i = 0; i < scene.lines.length; i++) {
        const line = scene.lines[i];
        if (config.selectedActors.length == 0) {
          line.state = "show";
        } else {
          const isSelectedActor = config.selectedActors.includes(line.actor);
          
          if (config.highlightOnly) {
            // Highlight mode: show all, but mark selected for highlighting
            line.state = isSelectedActor ? "highlight" : "show";
          } else {
            // Filter mode: hide non-selected actors
            line.state = isSelectedActor ? "show" : "hide";
          }
          
          // Cue lines logic (only in filter mode, not highlight mode)
          if (!config.highlightOnly && config.showLinesPrior && line.state == "show") {
            for (let j = i - 1; j >= 0; j--) {
              if (scene.lines[j].state == 'hide') scene.lines[j].state = "clue";
              if (scene.lines[j].actor) break;
            }
          }
        }
      }
    });
  });
  return script;
};

const script = reactive({});

const loadScript = async (scriptRef) => {
  if (!scriptRef) return;
  if(!scriptRef.script) {
    try {
    
      const response = await fetch(scriptRef.url);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      scriptRef.script = await response.json();
      
    } catch (error) {
      console.error('Failed to load script data:', error);
    }
  }
  Object.assign(script, scriptRef.script);
  markActive(script);
};

const loadSelectedScript = async () => {
  let scriptRef = scripts.find(s => s.name === selectedScript.value);
  if(!scriptRef) {
    scriptRef = scripts[0];
    selectedScript.value = scriptRef.name;
  }
  await loadScript(scriptRef);
  const newConfig = safeJSONparse(localStorage.getItem(`config.${selectedScript.value}`)) 
                          || {
                            selectedActors: [],
                            selectedActs: [],
                            selectedScenes: [],
                            showLinesPrior: false,
                            hideText: false,
                            highlightOnly: false
                          };
  Object.assign(config, newConfig);
}


watch(selectedScript, (newVal) => {
  if(typeof(newVal) == 'undefined') newVal = scripts[0];
  localStorage.setItem('script', JSON.stringify(newVal));
  loadSelectedScript();
}, { immediate: true });

watch(config, (newVal) => {
  markActive(script);
  t2v.cancel();
  localStorage.setItem(`config.${selectedScript.value}`, JSON.stringify(newVal));
});

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Get current script title
const currentScriptTitle = computed(() => {
  const s = scripts.find(s => s.name === selectedScript.value);
  return s?.title || 'Select Script';
});

// Script metadata for selector
const scriptMetadata = computed(() => {
  const metadata = {};
  scripts.forEach(s => {
    if (s.script) {
      const acts = s.script.acts || [];
      const actors = new Set();
      let sceneCount = 0;
      
      acts.forEach(act => {
        sceneCount += act.scenes?.length || 0;
        act.scenes?.forEach(scene => {
          scene.lines?.forEach(line => {
            if (line.actor) actors.add(line.actor);
          });
        });
      });
      
      metadata[s.name] = {
        actCount: acts.length,
        sceneCount,
        actorCount: actors.size
      };
    }
  });
  return metadata;
});

// Remove filter handlers
const removeActor = (actor) => {
  const index = config.selectedActors.indexOf(actor);
  if (index > -1) {
    config.selectedActors.splice(index, 1);
  }
};

const removeScene = (sceneNumber) => {
  const index = config.selectedScenes.indexOf(sceneNumber);
  if (index > -1) {
    config.selectedScenes.splice(index, 1);
  }
};

// Select script handler
const selectScript = (scriptName) => {
  selectedScript.value = scriptName;
};
</script>

<template>
  <div id="app" class="container mx-auto p-4">
    <!-- Script Selector Trigger -->
    <button @click="showScriptSelector = true" class="script-selector-trigger">
      <div class="script-trigger-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        <span class="script-trigger-title">{{ currentScriptTitle }}</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    
    <!-- Active Filters Bar -->
    <ActiveFilters 
      :config="config"
      :script="script"
      @open-sheet="showFilterSheet = true"
      @remove-actor="removeActor"
      @remove-scene="removeScene"
    />

    <!-- Script Content -->
    <ScriptDisplay :script="script" :hide-to-check="config.hideText" v-if="script" v-cloak/>

    <!-- Floating Action Buttons -->
    <div class="fab-container">
      <SceneNav :script="script" v-if="script.acts" />
      <button @click="t2v.toggleReading(script, config)" class="fab fab-read" v-if="t2v.available">
        <svg v-if="!t2v.speaking.value" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span class="fab-label">{{ t2v.speaking.value ? "Stop" : "Read" }}</span>
      </button>
      <button @click="t2v.skipToNext()" class="fab fab-next" v-if="t2v.speaking.value">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 15 12 5 21 5 3"></polygon>
          <rect x="16" y="3" width="3" height="18"></rect>
        </svg>
        <span class="fab-label">Next</span>
      </button>
      <button @click="scrollToTop" class="fab fab-top">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
        <span class="fab-label">Top</span>
      </button>
    </div>
    
    <!-- Modals -->
    <ScriptSelector 
      :open="showScriptSelector"
      :scripts="scripts"
      :selected="selectedScript"
      :script-metadata="scriptMetadata"
      @select="selectScript"
      @close="showScriptSelector = false"
    />
    
    <FilterSheet
      :open="showFilterSheet"
      :script="script"
      :config="config"
      @close="showFilterSheet = false"
    />
  </div>
</template>

<style scoped>
.script-selector-trigger {
  @apply w-full flex items-center justify-between p-4 mb-3;
  @apply bg-white dark:bg-gray-800 rounded-xl;
  @apply border dark:border-gray-700;
  @apply cursor-pointer text-left;
  @apply hover:border-blue-300 dark:hover:border-blue-600;
  @apply transition-colors;
}

.script-trigger-content {
  @apply flex items-center gap-3;
}

.script-trigger-title {
  @apply text-lg font-medium;
}
</style>
