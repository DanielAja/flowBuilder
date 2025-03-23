// Utility functions
function generateUniqueID() {
    try {
        return Math.random().toString(36).substr(2, 9);
    } catch (error) {
        console.error('Error generating unique ID:', error);
        return Date.now().toString(36); // Fallback
    }
}

function getFlows() {
    try {
        const flowsJson = localStorage.getItem('flows');
        console.log('Raw flow data from localStorage:', flowsJson);
        
        if (!flowsJson) {
            console.log('No flows found in localStorage');
            return [];
        }
        
        const flows = JSON.parse(flowsJson);
        console.log('Parsed flows:', flows);
        
        if (!Array.isArray(flows)) {
            console.error('Flows is not an array:', flows);
            return [];
        }
        
        return flows;
    } catch (error) {
        console.error('Error getting flows from localStorage:', error);
        return [];
    }
}

function saveFlows(flows) {
    try {
        if (!Array.isArray(flows)) {
            console.error('Cannot save flows: not an array', flows);
            return;
        }
        
        const flowsJson = JSON.stringify(flows);
        localStorage.setItem('flows', flowsJson);
        console.log('Saved flows to localStorage:', flowsJson);
    } catch (error) {
        console.error('Error saving flows to localStorage:', error);
    }
}

// YogaAsana class definition
class YogaAsana {
    constructor(name, side, image, description, difficulty, tags, transitionsAsana, sanskrit = "") {
        this.name = name;
        this.sanskrit = sanskrit;
        this.side = side;
        this.image = image;
        this.description = description;
        this.difficulty = difficulty;
        this.tags = tags;
        // Ensure transitionsAsana is always an array
        this.transitionsAsana = Array.isArray(transitionsAsana) ? transitionsAsana : [];
        this.duration = 7; // Default duration of 7 seconds
    }

    setDuration(duration) {
        this.duration = duration;
    }

    setSide(side) {
        this.side = side;
    }

    // Get the display name based on language preference
    getDisplayName(useSanskrit = false) {
        return useSanskrit && this.sanskrit ? this.sanskrit : this.name;
    }

    // Get the transition poses
    getTransitions() {
        return this.transitionsAsana;
    }
}

// Flow class definition
class Flow {
    constructor(name = '', description = '', time = 0, peakPose = '') {
        this.name = name;
        this.description = description;
        this.time = time;
        this.peakPose = peakPose;
        this.asanas = [];
        this.flowID = generateUniqueID();
        this.lastEdited = new Date().toISOString();
        this.lastFlowed = null; // Will be set when flow is practiced
    }

    calculateTotalDuration() {
        if (this.asanas.length === 0) {
            this.time = 0;
            return 0;
        }
        
        this.time = this.asanas.reduce((total, asana) => total + (asana.duration || 0), 0);
        return this.time;
    }

    addAsana(asana) {
        this.asanas.push(asana);
    }

    getAsana(name) {
        return this.asanas.find(asana => asana.name === name);
    }

    getAsanas() {
        return this.asanas;
    }
}

// Global variables
let editingFlow = new Flow();
let editMode = false;
let currentScreenId = 'homeScreen';
let asanas = [];
let dragSource = null;
let currentAsanaIndex = 0;
let isReversed = false;
let paused = false;
let lastUpdateTime = 0;
let animationFrameId = null;
let speechEnabled = false; // Default to speech disabled
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let useSanskritNames = localStorage.getItem('useSanskritNames') === 'true';

function displayFlowDuration(duration) {
    duration = Math.max(0, Math.round(duration)); // Ensure non-negative integer
    let hrs = Math.floor(duration / 3600);
    let mins = Math.floor((duration % 3600) / 60);
    let sec = duration % 60;
    
    let parts = [];
    
    if (hrs > 0) {
        parts.push(hrs.toString() + "h");
    }
    
    if (mins > 0 || (hrs > 0 && sec > 0)) {
        parts.push(mins.toString() + "min");
    }
    
    if (sec > 0 || (hrs === 0 && mins === 0)) {
        parts.push(sec.toString().padStart(2, '0') + "s");
    }
    
    return parts.join(" ");
}

function updateAsanaDisplay(asana) {
    const asanaNameElement = document.getElementById("asanaName");
    const asanaSideElement = document.getElementById("asanaSide");
    const asanaImageElement = document.getElementById("asanaImage");
    const nextAsanaNameElement = document.getElementById("nextAsanaName");
    const nextAsanaImageElement = document.getElementById("nextAsanaImage");
    const comingUpSection = document.querySelector(".coming-up");

    // Use the displayName based on the toggle setting
    if (asanaNameElement) {
        // Handle cases where getDisplayName might not exist
        if (typeof asana.getDisplayName === 'function') {
            asanaNameElement.textContent = asana.getDisplayName(useSanskritNames);
        } else {
            // Fallback to using name or sanskrit based on toggle
            asanaNameElement.textContent = useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name;
        }
    }
    if (asanaSideElement) asanaSideElement.textContent = asana.side;
    if (asanaImageElement) {
        asanaImageElement.src = asana.image;
        asanaImageElement.alt = `${asana.name} pose`;
        
        // Add error handling for missing images
        asanaImageElement.onerror = function() {
            this.onerror = null;
            this.src = '';
            this.style.display = 'flex';
            this.style.justifyContent = 'center';
            this.style.alignItems = 'center';
            this.style.background = '#f5f5f5';
            this.style.fontSize = '50px';
            this.innerText = '🧘‍♀️';
            console.log(`Missing image for ${asana.name}`);
        };
        
        // Flip the image if the side is left
        if (asana.side.toLowerCase() === 'left') {
            asanaImageElement.style.transform = 'scaleX(-1)';
        } else {
            asanaImageElement.style.transform = 'scaleX(1)';
        }
    }
    
    // Update next asana info
    const nextAsana = editingFlow.asanas[currentAsanaIndex + 1];
    if (nextAsana) {
        // Show the upcoming pose
        if (nextAsanaNameElement) {
            // Apply animation by resetting it
            nextAsanaNameElement.style.animation = 'none';
            nextAsanaNameElement.offsetHeight; // Trigger reflow
            nextAsanaNameElement.style.animation = 'fade-in 0.6s ease-out';
            
            // Handle cases where getDisplayName might not exist
            if (typeof nextAsana.getDisplayName === 'function') {
                nextAsanaNameElement.textContent = nextAsana.getDisplayName(useSanskritNames);
            } else {
                // Fallback to using name or sanskrit based on toggle
                nextAsanaNameElement.textContent = useSanskritNames && nextAsana.sanskrit ? nextAsana.sanskrit : nextAsana.name;
            }
        }
        if (nextAsanaImageElement) {
            // Apply animation by resetting it
            nextAsanaImageElement.style.animation = 'none';
            nextAsanaImageElement.offsetHeight; // Trigger reflow
            nextAsanaImageElement.style.animation = 'fade-in 0.6s ease-out';
            
            nextAsanaImageElement.style.display = ""; // Reset display style to default
            nextAsanaImageElement.src = nextAsana.image;
            nextAsanaImageElement.alt = `${nextAsana.name} pose`;
            
            // Add error handling for missing next pose images
            nextAsanaImageElement.onerror = function() {
                this.onerror = null;
                this.src = '';
                this.style.display = 'flex';
                this.style.justifyContent = 'center';
                this.style.alignItems = 'center';
                this.style.background = '#f5f5f5';
                this.style.fontSize = '40px';
                this.innerText = '🧘‍♀️';
                console.log(`Missing image for next pose: ${nextAsana.name}`);
            };
        }
        if (comingUpSection) {
            comingUpSection.style.display = "block";
            // Reset the container animation as well
            comingUpSection.style.animation = 'none';
            comingUpSection.offsetHeight; // Trigger reflow
            comingUpSection.style.animation = 'resize-container 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
            
            // Add specific height transition to animate the container resizing
            const currentHeight = comingUpSection.offsetHeight;
            comingUpSection.style.height = 'auto';
            const autoHeight = comingUpSection.offsetHeight;
            comingUpSection.style.height = currentHeight + 'px';
            
            // Force browser to recognize height change
            setTimeout(() => {
                comingUpSection.style.height = autoHeight + 'px';
                
                // Reset to auto after animation completes
                setTimeout(() => {
                    comingUpSection.style.height = 'auto';
                }, 500);
            }, 10);
        }
    } else {
        // Show a message about completing the flow
        const isLastPose = currentAsanaIndex === editingFlow.asanas.length - 1;
        if (isLastPose) {
            if (nextAsanaNameElement) nextAsanaNameElement.textContent = "Final pose";
            if (nextAsanaImageElement) {
                nextAsanaImageElement.style.display = "none"; // Hide the image
            }
            if (comingUpSection) {
                const firstText = comingUpSection.querySelector("p:first-child");
                if (firstText) firstText.textContent = "Up Next:";
                comingUpSection.style.display = "block";
            }
        } else {
            // Hide the coming up section when we're at the end of the flow
            if (comingUpSection) comingUpSection.style.display = "none";
        }
    }
    
    // Speak the name of the asana if speech is enabled
    if (speechEnabled && !paused) {
        speakAsanaName(asana.name, asana.side, asana.sanskrit);
    }

    console.log('Current Asana:', asana.name, 'Image:', asana.image, 'Duration:', asana.duration);
    console.log('Next Asana:', nextAsana ? nextAsana.name : 'End of flow', 'Image:', nextAsana ? nextAsana.image : 'End of flow image');

    // Ensure we return a valid numeric duration
    return asana.duration || 7; // Default to 7 seconds if not set
}

// Function to speak the asana name
function speakAsanaName(name, side, sanskrit = "") {
    // Don't do anything if speech is disabled
    if (!speechEnabled) return;
    
    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // Add visual feedback to both speech buttons
    const speechBtn = document.getElementById('speech-toggle');
    const speechFlowBtn = document.getElementById('speech-toggle-flow');
    if (speechBtn) speechBtn.classList.add('speaking');
    if (speechFlowBtn) speechFlowBtn.classList.add('speaking');
    
    // Create text to speak - include side only if it's Left or Right
    let textToSpeak = name;
    
    // Add Sanskrit pronunciation if enabled and available
    if (useSanskritNames && sanskrit) {
        textToSpeak = sanskrit;
    }
    
    if (side && (side.toLowerCase() === 'left' || side.toLowerCase() === 'right')) {
        textToSpeak += `, ${side} side`;
    }
    
    // Create and configure utterance
    speechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    speechUtterance.rate = 0.9; // Slightly slower for better clarity
    speechUtterance.pitch = 1;
    speechUtterance.volume = 1;
    
    // Add event listeners for speech events
    speechUtterance.onend = function() {
        if (speechBtn) speechBtn.classList.remove('speaking');
        if (speechFlowBtn) speechFlowBtn.classList.remove('speaking');
    };
    
    speechUtterance.onerror = function() {
        if (speechBtn) speechBtn.classList.remove('speaking');
        if (speechFlowBtn) speechFlowBtn.classList.remove('speaking');
        console.error('Speech synthesis error');
    };
    
    // Find a good voice (prefer female voice if available)
    let voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        // Look for English female voice
        let preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Female'));
        // If no female English voice, try any English voice
        if (!preferredVoice) preferredVoice = voices.find(v => v.lang.includes('en'));
        // If still no match, use the first available voice
        if (!preferredVoice) preferredVoice = voices[0];
        
        if (preferredVoice) {
            speechUtterance.voice = preferredVoice;
        }
    }
    
    // Handle the case when voices might not be loaded yet
    if (voices.length === 0) {
        speechSynthesis.onvoiceschanged = function() {
            voices = speechSynthesis.getVoices();
            let preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Female'));
            if (!preferredVoice) preferredVoice = voices.find(v => v.lang.includes('en'));
            if (!preferredVoice && voices.length > 0) preferredVoice = voices[0];
            
            if (preferredVoice) {
                speechUtterance.voice = preferredVoice;
                // Re-speak after voices are loaded
                speechSynthesis.speak(speechUtterance);
            }
        };
    } else {
        // Speak the text if voices are already loaded
        speechSynthesis.speak(speechUtterance);
    }
}

// Function to clear the build flow screen
function clearBuildAFlow() {
    // Reset form fields
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    
    // Clear flow table
    const table = document.getElementById('flowTable');
    if (table) {
        // Clear existing rows except header
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
    }
    
    // Reset flow duration
    const flowTime = document.getElementById('flowTime');
    if (flowTime) {
        flowTime.textContent = displayFlowDuration(0);
    }
    
    // Create a new flow
    editingFlow = new Flow();
    editMode = false;
}

// Screen management
function changeScreen(screenId) {
    console.log(`Changing screen to: ${screenId}`);
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    
    if (!targetScreen) {
        console.error(`Screen with ID ${screenId} not found`);
        return;
    }
    
    targetScreen.classList.add('active');
    currentScreenId = screenId;

    if (screenId === 'homeScreen') {
        displayFlows();
        
        // Hide the Sanskrit toggle when returning to home screen
        const sanskritToggle = document.querySelector('.sanskrit-toggle-global');
        if (sanskritToggle) {
            sanskritToggle.style.display = 'none';
        }
    } else if (screenId === 'buildScreen') {
        if (!editMode) {
            clearBuildAFlow();
        }
        
        // Show the Sanskrit toggle on build screen
        const sanskritToggle = document.querySelector('.sanskrit-toggle-global');
        if (sanskritToggle) {
            sanskritToggle.style.display = 'flex';
        }
        
        // Initialize the sort indicator when switching to build screen
        setTimeout(() => {
            const tableHeader = document.querySelector('#flowTable th:first-child');
            if (tableHeader) {
                // Clear any existing classes first
                tableHeader.classList.remove('ascending', 'descending');
                
                // Set initial class based on tableInDescendingOrder
                tableHeader.classList.add(tableInDescendingOrder ? 'descending' : 'ascending');
                tableHeader.title = tableInDescendingOrder 
                    ? 'Sorted by largest number first - Click to reverse'
                    : 'Sorted by smallest number first - Click to reverse';
            }
        }, 100); // Short delay to ensure DOM is ready
    } else if (screenId === 'flowScreen') {
        // Show the Sanskrit toggle on flow screen
        const sanskritToggle = document.querySelector('.sanskrit-toggle-global');
        if (sanskritToggle) {
            sanskritToggle.style.display = 'flex';
        }
    }
}

// Function to start a new flow from the home screen
function startNewFlow() {
    console.log('Starting new flow...');
    
    // Create a new flow object
    editingFlow = new Flow();
    editMode = false;
    
    // Switch to build screen
    console.log('Switching to build screen...');
    changeScreen('buildScreen');
    
    // Reset form fields after switching screen
    setTimeout(() => {
        console.log('Resetting form fields...');
        const titleInput = document.getElementById('title');
        const descriptionInput = document.getElementById('description');
        if (titleInput) {
            console.log('Found title input, clearing...');
            titleInput.value = '';
        } else {
            console.error('Title input not found');
        }
        
        if (descriptionInput) {
            console.log('Found description input, clearing...');
            descriptionInput.value = '';
        } else {
            console.error('Description input not found');
        }
        
        // Clear flow table
        const table = document.getElementById('flowTable');
        if (table) {
            console.log('Found flow table, clearing rows...');
            // Clear existing rows except header
            while (table.rows.length > 1) {
                table.deleteRow(1);
            }
        } else {
            console.error('Flow table not found');
        }
        
        // Reset flow duration
        const flowTime = document.getElementById('flowTime');
        if (flowTime) {
            console.log('Resetting flow duration display...');
            flowTime.textContent = displayFlowDuration(0);
        } else {
            console.error('Flow time element not found');
        }

        // Clear recommended poses
        const allPoses = document.querySelectorAll('.asana-item');
        allPoses.forEach(pose => {
            pose.classList.remove('recommended', 'highlight');
        });
    }, 100);
}

// Flow management
function selectAsana(asana) {
    // Save current scroll position of the asana list
    const asanaList = document.getElementById('asanaList');
    const scrollPosition = asanaList ? asanaList.scrollLeft : 0;
    
    const table = document.getElementById("flowTable");
    if (!table) {
        console.error("Flow table not found");
        return;
    }
    
    // Create the new asana object
    const newAsana = new YogaAsana(
        asana.name,
        asana.side,
        asana.image,
        asana.description,
        asana.difficulty,
        [...asana.tags || []],
        [...asana.transitionsAsana || []],
        asana.sanskrit
    );
    newAsana.setDuration(7); // Default 7 seconds
    
    // Add to the beginning or end of the array based on sort order
    if (tableInDescendingOrder) {
        // If in descending order, add to the beginning
        editingFlow.asanas.unshift(newAsana);
    } else {
        // If in ascending order, add to the end
        editingFlow.addAsana(newAsana);
    }
    
    // Rebuild the table to ensure proper order and numbering
    rebuildFlowTable();
    
    // The new row will be either the first or last depending on sort order
    let rowIndex = tableInDescendingOrder ? 1 : table.rows.length - 1;
    let row = table.rows[rowIndex];
    
    updateFlowDuration();
    
    console.log(`Added asana: ${asana.name} to the flow. Current asanas:`, editingFlow.asanas);
    
    // Update recommended poses based on the new last pose
    updateRecommendedPoses();
    
    // Restore scroll position after refreshing the list
    if (asanaList) {
        setTimeout(() => {
            asanaList.scrollLeft = scrollPosition;
        }, 10);
    }
    
    // Add visual feedback on the table (only if we found the row)
    if (row) {
        row.classList.add('highlight-added');
        setTimeout(() => {
            row.classList.remove('highlight-added');
        }, 1500);
    }
}

// Function to create a side dropdown menu
function createSideDropdown(side) {
    if (side === "Center") {
        return '<select class="side-select" onchange="updateAsanaImageOrientation(this)"><option value="Center" selected>Center</option></select>';
    }
    return `<select class="side-select" onchange="updateAsanaImageOrientation(this)">
        <option value="Right" ${side === "Right" ? "selected" : ""}>Right</option>
        <option value="Left" ${side === "Left" ? "selected" : ""}>Left</option>
    </select>`;
}

function updateAsanaImageOrientation(selectElement) {
    // Get the row containing this select element
    const row = selectElement.closest('tr');
    if (!row) return;
    
    // Find the image in this row
    const img = row.querySelector('.table-asana-img');
    if (!img) return;
    
    // Apply transform based on selected side
    if (selectElement.value === "Left") {
        img.style.transform = 'scaleX(-1)';
    } else {
        img.style.transform = 'scaleX(1)';
    }
    
    // Update the asana in the editingFlow
    const rowIndex = row.rowIndex - 1; // Adjust for header row
    if (editingFlow && editingFlow.asanas && editingFlow.asanas[rowIndex]) {
        editingFlow.asanas[rowIndex].side = selectElement.value;
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    }
}

// Track whether table is in descending order (initialized to true so the first click sorts ascending)
let tableInDescendingOrder = true;

// UI update functions
function updateRowNumbers() {
    const table = document.getElementById("flowTable");
    if (!table) return;
    
    const rows = Array.from(table.rows).slice(1);
    const totalRows = rows.length;
    
    rows.forEach((row, index) => {
        // If in descending order, number from highest to lowest
        if (tableInDescendingOrder) {
            row.cells[0].innerHTML = totalRows - index;
        } else {
            row.cells[0].innerHTML = index + 1;
        }
        
        // Add drag attributes for every row
        row.setAttribute("draggable", "true");
        row.setAttribute("data-index", index);
    });
}

function updateFlowDuration() {
    // Check for empty values and set to 7 seconds
    const durationInputs = document.querySelectorAll('#flowTable .duration-wrapper input[type="number"]');
    durationInputs.forEach(input => {
        if (input.value === '' || parseInt(input.value) === 0) {
            input.value = 7;
        }
    });

    // Update durations in the flow object
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        if (index < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            if (durationInput) {
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 7;
            }
        }
    });

    const totalDuration = editingFlow.calculateTotalDuration();
    const flowTime = document.getElementById('flowTime');
    if (flowTime) {
        flowTime.textContent = displayFlowDuration(totalDuration);
    }
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to automatically save flow changes
function autoSaveFlow() {
    // Get current values from form
    const title = document.getElementById('title')?.value;
    const description = document.getElementById('description')?.value;
    
    // Require at least a title
    if (!title || editingFlow.asanas.length === 0) {
        return; // Don't auto-save if no title or no asanas
    }
    
    // Update flow properties
    editingFlow.name = title;
    editingFlow.description = description;
    editingFlow.calculateTotalDuration();
    
    // Get existing flows
    const flows = getFlows();
    
    // Find and update existing flow
    const flowIndex = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
    if (flowIndex !== -1) {
        flows[flowIndex] = { ...editingFlow };
        saveFlows(flows);
        
        // Show a brief save indicator
        showSaveIndicator();
    }
}

// Show a brief "Saved" indicator
function showSaveIndicator() {
    // Check if indicator already exists
    let indicator = document.getElementById('save-indicator');
    
    if (!indicator) {
        // Create indicator if it doesn't exist
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.textContent = 'Changes saved';
        document.querySelector('.build-content')?.appendChild(indicator);
    }
    
    // Show the indicator
    indicator.classList.add('visible');
    
    // Hide the indicator after a delay
    setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1500);
}

function removePose(button) {
    const row = button.closest('tr');
    if (!row) return;
    
    const table = document.getElementById("flowTable");
    if (!table) return;
    
    const rowIndex = row.rowIndex;
    
    // Get the data-index attribute to find the actual array index
    const dataIndex = parseInt(row.getAttribute('data-index'));
    
    // If data-index is valid, use it to remove from array
    if (!isNaN(dataIndex) && dataIndex >= 0 && dataIndex < editingFlow.asanas.length) {
        editingFlow.asanas.splice(dataIndex, 1);
    } else {
        // Fallback to using row index if data-index is invalid
        const arrayIndex = rowIndex - 1;
        if (arrayIndex >= 0 && arrayIndex < editingFlow.asanas.length) {
            editingFlow.asanas.splice(arrayIndex, 1);
        }
    }
    
    // Rebuild the entire table to ensure proper order and numbering
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Refresh the asana list to update recommended poses
    populateAsanaList();
}

function saveFlow() {
    const title = document.getElementById('title')?.value;
    const description = document.getElementById('description')?.value;

    if (!editingFlow) {
        editingFlow = new Flow();
    }

    // If there are no poses, just return home without saving
    if (editingFlow.asanas.length === 0) {
        changeScreen('homeScreen');
        editingFlow = new Flow();
        editMode = false;
        return;
    }

    // Require title only if there are poses
    if (!title) {
        const userChoice = confirm('Would you like to add a title to save this flow, or return home without saving?\n\nClick OK to add a title\nClick Cancel to return home');
        if (userChoice) {
            // User clicked OK - focus the title input
            const titleInput = document.getElementById('title');
            if (titleInput) {
                titleInput.focus();
            }
            return;
        } else {
            // User clicked Cancel - return home without saving
            changeScreen('homeScreen');
            editingFlow = new Flow();
            editMode = false;
            return;
        }
    }

    editingFlow.name = title;
    editingFlow.description = description;
    editingFlow.calculateTotalDuration();
    
    // Update lastEdited timestamp
    editingFlow.lastEdited = new Date().toISOString();

    // Update asana durations and sides from input fields
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        if (index < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            const sideSelect = row.querySelector('select.side-select');
            
            if (durationInput && sideSelect) {
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 7;
                editingFlow.asanas[index].side = sideSelect.value;
            }
        }
    });

    // Get existing flows from storage
    const flows = getFlows();
    console.log('Current flows before save:', flows);
    
    if (editMode) {
        // Update existing flow
        const index = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
        if (index !== -1) {
            // Preserve lastFlowed timestamp if it exists
            const lastFlowed = flows[index].lastFlowed;
            flows[index] = { ...editingFlow };
            if (lastFlowed) {
                flows[index].lastFlowed = lastFlowed;
            }
            console.log('Updated flow at index', index);
        } else {
            console.error('Flow not found for editing');
            return;
        }
    } else {
        // Add new flow
        const flowToSave = { ...editingFlow };
        flows.push(flowToSave);
        console.log('Added new flow with ID:', flowToSave.flowID);
    }

    // Save flows back to storage
    saveFlows(flows);
    console.log('Saved flows:', flows);
    
    // Update UI
    displayFlows();
    changeScreen('homeScreen');
    
    // Reset editing state
    editingFlow = new Flow();
    editMode = false;
}

// Helper function to format relative time
function formatRelativeTime(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    
    // For older dates, return the actual date
    return date.toLocaleDateString();
}

function displayFlows() {
    let flows = getFlows();
    console.log('Raw flows:', flows); // Debug log
    
    // Sort flows by lastFlowed (most recent first)
    flows.sort((a, b) => {
        // First priority: lastFlowed (those with null lastFlowed go to the bottom)
        if (a.lastFlowed && !b.lastFlowed) return -1;
        if (!a.lastFlowed && b.lastFlowed) return 1;
        if (a.lastFlowed && b.lastFlowed) {
            const timeComparison = new Date(b.lastFlowed) - new Date(a.lastFlowed);
            if (timeComparison !== 0) return timeComparison;
        }
        
        // Second priority: lastEdited
        return new Date(b.lastEdited) - new Date(a.lastEdited);
    });
    
    console.log('Sorted flows:', flows); // Debug log
    
    const flowList = document.getElementById('savedFlowsList');
    
    if (!flowList) {
        console.error("Element with ID 'savedFlowsList' not found");
        return;
    }
    
    flowList.innerHTML = '';

    if (flows.length === 0) {
        console.log('No flows available');
        flowList.innerHTML = '<div class="empty-message"><p>No flows available.</p><button class="primary-btn" onclick="startNewFlow()">Build your first flow</button></div>';
    } else {
        console.log(`Adding ${flows.length} flows to the list`);
        flows.forEach(flow => {
            const flowItem = document.createElement('div');
            flowItem.className = 'flow-item';
            
            // Add 'recent' class if practiced in the last 24 hours
            if (flow.lastFlowed) {
                const lastFlowedDate = new Date(flow.lastFlowed);
                const now = new Date();
                const diffHours = (now - lastFlowedDate) / (1000 * 60 * 60);
                
                if (diffHours < 24) {
                    flowItem.classList.add('recent');
                }
            }
            
            // Format timestamps for display
            const lastFlowedText = formatRelativeTime(flow.lastFlowed);
            const lastEditedText = formatRelativeTime(flow.lastEdited);
            
            flowItem.innerHTML = `
                <div class="flow-info">
                    <h4>${flow.name}</h4>
                    <p class="flow-description">(${displayFlowDuration(flow.time)}) ${flow.description || ''}</p>
                    <div class="flow-timestamps">
                        <span class="timestamp ${flow.lastFlowed ? 'active' : ''}">Last flowed: ${lastFlowedText}</span>
                        <span class="timestamp">Last edited: ${lastEditedText}</span>
                    </div>
                </div>
                <div class="flow-actions">
                    <button class="flow-btn" onclick="playFlow('${flow.flowID}')">FLOW</button>
                    <button class="edit-btn" onclick="editFlow('${flow.flowID}')"></button>
                    <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')"></button>
                </div>
            `;
            flowList.appendChild(flowItem);
        });
    }

    // Update flow count
    const flowCount = document.querySelector('.flow-count');
    if (flowCount) {
        flowCount.textContent = `${flows.length} flow${flows.length !== 1 ? 's' : ''}`;
    }
}

function deleteFlow(flowID) {
    if (confirm('Are you sure you want to delete this flow?')) {
        let flows = getFlows();
        flows = flows.filter(flow => flow.flowID !== flowID);
        saveFlows(flows);
        displayFlows();
    }
}

function playFlow(flowID) {
    const flows = getFlows();
    const flowIndex = flows.findIndex(flow => flow.flowID === flowID);
    
    if (flowIndex === -1) {
        console.error(`Flow with ID ${flowID} not found`);
        return;
    }
    
    const flowToPlay = flows[flowIndex];
    
    // Set up the flow for practice
    editingFlow = new Flow();
    Object.assign(editingFlow, flowToPlay);
    
    // Ensure all asanas have proper methods by creating proper YogaAsana instances
    if (editingFlow.asanas && Array.isArray(editingFlow.asanas)) {
        console.log("Converting flow asanas to YogaAsana instances");
        editingFlow.asanas = editingFlow.asanas.map(asana => {
            // Check if asana is already a proper YogaAsana instance
            if (asana instanceof YogaAsana && typeof asana.getDisplayName === 'function') {
                return asana;
            }
            
            // Create a new YogaAsana instance
            const newAsana = new YogaAsana(
                asana.name, 
                asana.side, 
                asana.image,
                asana.description,
                asana.difficulty,
                asana.tags || [],
                asana.transitionsAsana || [],
                asana.sanskrit || ""
            );
            newAsana.setDuration(asana.duration || 7);
            return newAsana;
        });
    }
    
    currentAsanaIndex = 0;
    paused = false;
    
    // Update lastFlowed timestamp in the original flows array
    flows[flowIndex].lastFlowed = new Date().toISOString();
    saveFlows(flows); // Save the updated timestamp
    
    // Reset any existing flow complete states
    const existingCompleteContainer = document.querySelector('.countdown-container.flow-complete');
    if (existingCompleteContainer) {
        existingCompleteContainer.classList.remove('flow-complete');
    }
    
    // Initialize the practice screen
    changeScreen('flowScreen');
    
    // Initialize both speech button states
    // 1. Bottom speech toggle button
    const speechToggleBtn = document.getElementById('speech-toggle');
    if (speechToggleBtn) {
        const buttonLabel = speechToggleBtn.querySelector('span');
        
        if (speechEnabled) {
            speechToggleBtn.classList.remove('speech-disabled');
            speechToggleBtn.title = "Voice guidance is on - Click to turn off";
            if (buttonLabel) buttonLabel.textContent = "Sound: ON";
        } else {
            speechToggleBtn.classList.add('speech-disabled');
            speechToggleBtn.title = "Voice guidance is off - Click to turn on";
            if (buttonLabel) buttonLabel.textContent = "Sound: OFF";
        }
    }
    
    // Initialize Sanskrit toggle
    const sanskritToggle = document.getElementById('sanskrit-toggle-flow');
    if (sanskritToggle) {
        sanskritToggle.checked = useSanskritNames;
    }
    
    // 2. Flow screen speech toggle button
    const speechToggleFlowBtn = document.getElementById('speech-toggle-flow');
    if (speechToggleFlowBtn) {
        if (speechEnabled) {
            speechToggleFlowBtn.classList.remove('speech-disabled');
            speechToggleFlowBtn.title = "Voice guidance is on - Click to turn off";
        } else {
            speechToggleFlowBtn.classList.add('speech-disabled');
            speechToggleFlowBtn.title = "Voice guidance is off - Click to turn on";
        }
    }
    
    // Start the flow if it has asanas
    if (editingFlow.asanas && editingFlow.asanas.length > 0) {
        console.log("Starting flow with asanas:", editingFlow.asanas.length);
        
        // Reset current asana index and pause state
        currentAsanaIndex = 0;
        paused = false;
        
        // Get the first asana
        const asana = editingFlow.asanas[currentAsanaIndex];
        console.log("First asana:", asana.name, "Duration:", asana.duration);
        
        // Update the display and get the duration
        const duration = updateAsanaDisplay(asana);
        console.log("Display updated, duration:", duration);
        
        // Set the proper pause button icon
        const pauseBtn = document.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
            pauseBtn.classList.remove('paused');
            pauseBtn.title = "Pause flow";
        }
        
        // Make sure the countdown container has the proper SVG structure
        const countdownContainer = document.querySelector('.countdown-container');
        if (countdownContainer) {
            // Remove flow-complete class if it exists
            countdownContainer.classList.remove('flow-complete');
            
            countdownContainer.innerHTML = `
                <svg class="countdown-svg" viewBox="0 0 100 100">
                    <circle r="45" cx="50" cy="50" fill="transparent" stroke="#ddd" stroke-width="10"></circle>
                    <circle id="countdown-circle" r="45" cx="50" cy="50" fill="transparent" 
                            stroke="#ff8c00" stroke-width="10" stroke-dasharray="282.7" 
                            stroke-dashoffset="0" transform="rotate(-90 50 50)"></circle>
                </svg>
                <div id="countdown">${displayFlowDuration(duration)}</div>
            `;
        }
        
        // Clear any existing animation frame/timer
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }
        
        // Set up the countdown timer with a slight delay to ensure the DOM is ready
        setTimeout(() => {
            console.log("Starting countdown timer for first asana");
            startCountdownTimer(duration);
        }, 100);
    } else {
        console.warn("No asanas in the flow to start!");
    }
}

function startCountdownTimer(duration) {
    console.log("Starting countdown timer with duration:", duration);
    const countdownElement = document.getElementById('countdown');
    const countdownCircle = document.getElementById('countdown-circle');
    if (!countdownElement || !countdownCircle) {
        console.error("Countdown elements not found");
        return;
    }
    
    // Make sure we have a valid duration
    if (!duration || isNaN(duration) || duration <= 0) {
        duration = 7; // Default to 7 seconds if invalid
        console.warn("Invalid duration, using default of 7 seconds");
    }
    
    // Reset the pause state when starting a new timer
    paused = false;
    
    // Initialize time left
    let timeLeft = duration;
    countdownElement.textContent = displayFlowDuration(timeLeft);
    
    // Calculate the circle circumference (2 * PI * radius)
    const circumference = 2 * Math.PI * 45; // The circle has r=45
    countdownCircle.style.strokeDasharray = circumference;
    
    // Reset the countdown animation
    countdownCircle.style.strokeDashoffset = "0";
    
    // Clear any existing timer
    if (animationFrameId) {
        console.log("Clearing existing timer");
        clearTimeout(animationFrameId);
        animationFrameId = null;
    }
    
    // Update timer function
    const updateTimer = function() {
        // Only decrement if not paused
        if (!paused) {
            timeLeft -= 1;
            console.log("Time left:", timeLeft);
            
            // Update the display
            if (countdownElement) {
                countdownElement.textContent = displayFlowDuration(timeLeft);
            }
            
            // Update the circle animation - offset increases as time decreases
            if (countdownCircle) {
                const dashOffset = circumference * (timeLeft / duration);
                countdownCircle.style.strokeDashoffset = circumference - dashOffset;
            }
            
            // Check if time is up
            if (timeLeft <= 0) {
                console.log("Time up! Moving to next asana");
                // Move to next asana
                currentAsanaIndex++;
                if (currentAsanaIndex < editingFlow.asanas.length) {
                    const nextAsana = editingFlow.asanas[currentAsanaIndex];
                    console.log("Next asana:", nextAsana.name);
                    const nextDuration = updateAsanaDisplay(nextAsana);
                    timeLeft = nextDuration;
                    
                    // Reset the circle animation for the next pose
                    if (countdownCircle) {
                        countdownCircle.style.strokeDasharray = circumference;
                        countdownCircle.style.strokeDashoffset = "0";
                    }
                } else {
                    console.log("End of flow reached!");
                    // End of flow - transform timer into a home button
                    const countdownContainer = document.querySelector('.countdown-container');
                    if (countdownContainer) {
                        // Replace the countdown with a home button
                        countdownContainer.innerHTML = `
                            <button class="timer-home-btn" onclick="changeScreen('homeScreen')">
                                <span>Home</span>
                            </button>
                        `;
                        countdownContainer.classList.add('flow-complete');
                    }
                    return; // Exit the timer loop at the end of the flow
                }
            }
        }
        
        // Schedule the next update
        animationFrameId = setTimeout(updateTimer, 1000);
    };
    
    // Start the timer immediately with first update
    console.log("Starting timer with first update");
    updateTimer();
}

function endFlow() {
    // Show a confirmation message
    if (confirm('Are you sure you want to end this flow?')) {
        // Clear the timer if it exists
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }

        // If the flow has a lastFlowed timestamp, keep it
        // Since the user is manually ending the flow, we consider it "completed"
        const flows = getFlows();
        const flowIndex = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
        
        if (flowIndex !== -1) {
            // Only update if the flow was already saved
            flows[flowIndex].lastFlowed = new Date().toISOString();
            saveFlows(flows);
        }
        
        // Return to home screen
        changeScreen('homeScreen');
    }
}

function togglePause() {
    console.log("Toggle pause called. Current state:", paused);
    
    // Check if the flow is already complete (timer turned into home button)
    const flowComplete = document.querySelector('.countdown-container.flow-complete');
    if (flowComplete) {
        console.log("Flow is complete, returning to home screen");
        // If flow is complete, just go back to home
        changeScreen('homeScreen');
        return;
    }
    
    // Toggle pause state
    paused = !paused;
    console.log("New pause state:", paused);
    
    // Update pause button appearance
    const pauseBtn = document.querySelector('.pause-btn');
    if (pauseBtn) {
        if (paused) {
            // Change to play icon when paused
            pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            pauseBtn.classList.add('paused');
            pauseBtn.title = "Resume flow";
            
            // Pause speech if it's currently speaking
            if (speechSynthesis.speaking) {
                console.log("Pausing speech synthesis");
                speechSynthesis.pause();
            }
        } else {
            // Change to pause icon when playing
            pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
            pauseBtn.classList.remove('paused');
            pauseBtn.title = "Pause flow";
            
            // Resume speech if it was paused
            if (speechSynthesis.paused) {
                console.log("Resuming speech synthesis");
                speechSynthesis.resume();
            }
            
            // If timer was paused and there's no active timer, restart it
            if (!animationFrameId && editingFlow.asanas && currentAsanaIndex < editingFlow.asanas.length) {
                console.log("Restarting timer after pause");
                const asana = editingFlow.asanas[currentAsanaIndex];
                // Use the displayed time value if available
                const countdownElement = document.getElementById('countdown');
                const timeText = countdownElement ? countdownElement.textContent : null;
                let remainingDuration = asana.duration;
                
                if (timeText) {
                    // Parse the displayed time to get remaining seconds
                    const matches = timeText.match(/(\d+)s/);
                    if (matches && matches[1]) {
                        remainingDuration = parseInt(matches[1]);
                    }
                }
                
                // Restart with the current remaining time
                startCountdownTimer(remainingDuration);
            }
        }
    }
}

function toggleSpeech() {
    speechEnabled = !speechEnabled;
    
    // Update global speech toggle
    const speechToggleGlobal = document.getElementById('speech-toggle-global');
    
    if (speechEnabled) {
        // Update global speech toggle
        if (speechToggleGlobal) {
            speechToggleGlobal.checked = true;
        }
        
        // Speak the current pose if not paused
        if (!paused && editingFlow.asanas && editingFlow.asanas[currentAsanaIndex]) {
            const asana = editingFlow.asanas[currentAsanaIndex];
            speakAsanaName(asana.name, asana.side);
        }
    } else {
        // Update main speech toggle button
        if (speechToggleBtn) {
            const buttonLabel = speechToggleBtn.querySelector('span');
            speechToggleBtn.classList.add('speech-disabled');
            speechToggleBtn.title = "Voice guidance is off - Click to turn on";
            if (buttonLabel) buttonLabel.textContent = "Sound: OFF";
        }
        
        // Update flow screen speech toggle button
        if (speechToggleFlowBtn) {
            speechToggleFlowBtn.classList.add('speech-disabled');
            speechToggleFlowBtn.title = "Voice guidance is off - Click to turn on";
        }

        // Update global speech toggle
        if (speechToggleGlobal) {
            speechToggleGlobal.checked = false;
        }
        
        // Stop any current speech
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
    }
}

// Add event listener for the global speech toggle
document.addEventListener('DOMContentLoaded', function() {
    const speechToggleGlobal = document.getElementById('speech-toggle-global');
    if (speechToggleGlobal) {
        speechToggleGlobal.addEventListener('change', function() {
            if (this.checked !== speechEnabled) {
                toggleSpeech();
            }
        });
    }
});

function editFlow(flowID) {
    const flows = getFlows();
    const flowToEdit = flows.find(flow => flow.flowID === flowID);
    
    if (!flowToEdit) {
        console.error(`Flow with ID ${flowID} not found`);
        return;
    }
    
    // Create a deep copy of the flow
    editingFlow = new Flow();
    Object.assign(editingFlow, flowToEdit);
    
    // Make sure the asanas are proper objects
    if (editingFlow.asanas && Array.isArray(editingFlow.asanas)) {
        editingFlow.asanas = editingFlow.asanas.map(asana => {
            // Make sure each asana is a proper YogaAsana object
            if (!(asana instanceof YogaAsana)) {
                const newAsana = new YogaAsana(
                    asana.name, 
                    asana.side, 
                    asana.image,
                    asana.description,
                    asana.difficulty,
                    asana.tags || [],
                    asana.transitionsAsana || [],
                    asana.sanskrit || ""
                );
                newAsana.setDuration(asana.duration || 7);
                return newAsana;
            }
            return asana;
        });
    }
    
    // Set edit mode
    editMode = true;
    
    // Switch to build screen
    changeScreen('buildScreen');
    
    // Update form fields with flow data
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    
    if (titleInput) titleInput.value = editingFlow.name || '';
    if (descriptionInput) descriptionInput.value = editingFlow.description || '';
    
    // Ensure all asanas have getDisplayName method
    editingFlow.asanas = editingFlow.asanas.map(asana => {
        // If asana is not already a YogaAsana instance with the method
        if (!asana.getDisplayName) {
            const newAsana = new YogaAsana(
                asana.name, 
                asana.side, 
                asana.image,
                asana.description,
                asana.difficulty,
                asana.tags || [],
                asana.transitionsAsana || [],
                asana.sanskrit || ""
            );
            newAsana.setDuration(asana.duration || 7);
            return newAsana;
        }
        return asana;
    });
    
    // Use the rebuildFlowTable function to populate the table
    rebuildFlowTable();
    
    console.log('Editing flow:', editingFlow.name, 'with', editingFlow.asanas.length, 'asanas');
}

// Function to toggle the table sort order
function sortTableByLargestNumber() {
    const table = document.getElementById('flowTable');
    if (!table) return;
    
    // Toggle the sort order
    tableInDescendingOrder = !tableInDescendingOrder;
    
    // Get all rows except the header
    const rows = Array.from(table.rows).slice(1);
    const totalRows = rows.length;
    
    // Keep a copy of the original asanas array
    const originalAsanas = [...editingFlow.asanas];
    
    // Reverse the asanas array
    editingFlow.asanas = originalAsanas.slice().reverse();
    
    // Rebuild the table
    rebuildFlowTable();
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
    
    // Update visual indication that the table has been sorted
    updateSortIndicator();
}

// Function to update the sort indicator in the table header
function updateSortIndicator() {
    const tableHeader = document.querySelector('#flowTable th:first-child');
    if (tableHeader) {
        // Clear any existing classes first
        tableHeader.classList.remove('ascending', 'descending');
        
        if (tableInDescendingOrder) {
            // Add descending class and update header content
            tableHeader.classList.add('descending');
            tableHeader.innerHTML = 'Number';
            tableHeader.title = 'Sorted by largest number first - Click to reverse';
            
            // Show a brief animated toast notification
            showToastNotification('Sorted: Largest First');
        } else {
            // Add ascending class and update header content
            tableHeader.classList.add('ascending');
            tableHeader.innerHTML = 'Number';
            tableHeader.title = 'Sorted by smallest number first - Click to reverse';
            
            // Show a brief animated toast notification
            showToastNotification('Sorted: Smallest First');
        }
        
        // Add a highlighting effect
        tableHeader.classList.add('highlight-sort');
        setTimeout(() => {
            tableHeader.classList.remove('highlight-sort');
        }, 1000);
    }
}

// Function to show a toast notification
function showToastNotification(message) {
    // Check if a toast already exists and remove it
    const existingToast = document.getElementById('sort-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create a new toast element
    const toast = document.createElement('div');
    toast.id = 'sort-toast';
    toast.className = 'toast-notification';
    toast.innerHTML = `<span>${message}</span>`;
    
    // Add to the document
    document.body.appendChild(toast);
    
    // Trigger animation by adding show class after a brief delay
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove the toast after animation completes
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 2500);
}

// Function to update the date display
function updateDate() {
    const dateElement = document.querySelector('.flow-date h3');
    if (dateElement) {
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const today = new Date();
        dateElement.textContent = `Today, ${today.toLocaleDateString('en-US', options)}`;
    }
}

// Main function to load asanas from XML
async function loadAsanasFromXML() {
    try {
        console.log("Loading asanas from XML...");
        
        // Fetch the XML file
        const response = await fetch('asanas.xml');
        const xmlText = await response.text();
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Get all asana elements
        const asanaElements = xmlDoc.getElementsByTagName('asana');
        console.log(`Found ${asanaElements.length} asanas in XML`);
        
        // Clear existing asanas
        asanas = [];
        
        // Process each asana
        for (let i = 0; i < asanaElements.length; i++) {
            const asanaElem = asanaElements[i];
            
            // Extract basic info
            const name = asanaElem.getElementsByTagName('n')[0]?.textContent || 'Unknown Pose';
            const sanskrit = asanaElem.getElementsByTagName('sanskrit')[0]?.textContent || '';
            const side = asanaElem.getElementsByTagName('side')[0]?.textContent || 'Center';
            const image = asanaElem.getElementsByTagName('image')[0]?.textContent || 'images/webp/default-pose.webp';
            const description = asanaElem.getElementsByTagName('description')[0]?.textContent || '';
            const difficulty = asanaElem.getElementsByTagName('difficulty')[0]?.textContent || 'Beginner';
            
            // Extract tags
            const tagElements = asanaElem.getElementsByTagName('tag');
            const tags = [];
            for (let j = 0; j < tagElements.length; j++) {
                tags.push(tagElements[j].textContent);
            }
            
            // Extract transitions
            const transitionElements = asanaElem.getElementsByTagName('transition');
            const transitions = [];
            for (let j = 0; j < transitionElements.length; j++) {
                transitions.push(transitionElements[j].textContent);
            }
            
            // Create asana object
            const asana = new YogaAsana(
                name,
                side,
                image,
                description,
                difficulty,
                tags,
                transitions,
                sanskrit
            );
            
            // Add to asanas array
            asanas.push(asana);
        }
        
        console.log('Successfully loaded asanas from XML:', asanas.length);
        populateAsanaList();
        
    } catch (error) {
        console.error('Error loading asanas from XML:', error);
        // Fallback to default asanas if XML loading fails
        asanas = [
            new YogaAsana(
                "Downward Facing Dog",
                "Center",
                "images/webp/downward-facing-dog.webp",
                "Downward Facing Dog is a standing pose that tones the legs and arms, while stretching them. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Stretch"],
                ["Plank", "Cobra"],
                "Adho Mukha Svanasana"
            ),
            new YogaAsana(
                "Tree Pose",
                "Right",
                "images/webp/tree-pose.webp",
                "Tree Pose is a standing pose that improves balance and concentration. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Balance"],
                ["Mountain Pose", "Warrior 3"],
                "Vrksasana"
            ),
            new YogaAsana(
                "Warrior 2",
                "Right",
                "images/webp/warrior-2.webp",
                "Warrior 2 is a standing pose that strengthens the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Strength"],
                ["Mountain Pose", "Triangle Pose"],
                "Virabhadrasana II"
            ),
            new YogaAsana(
                "Triangle Pose",
                "Right",
                "images/triangle-pose.webp",
                "Triangle Pose is a standing pose that stretches the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Stretch"],
                ["Warrior 2", "Half Moon Pose"],
                "Trikonasana"
            )
        ];
        console.log('Loaded fallback asanas');
        populateAsanaList();
    }
}

// Function to get recommended poses based on the last pose in the flow
function getRecommendedPoses() {
    if (!editingFlow || !editingFlow.asanas || editingFlow.asanas.length === 0) {
        return [];
    }
    
    // Get the last pose based on the current table order
    let lastAsana;
    if (tableInDescendingOrder) {
        // If in descending order, the last pose is at the beginning of the array
        lastAsana = editingFlow.asanas[0];
    } else {
        // If in ascending order, the last pose is at the end of the array
        lastAsana = editingFlow.asanas[editingFlow.asanas.length - 1];
    }
    
    if (!lastAsana) {
        return [];
    }
    
    // Get transition asana names from the last asana
    const transitionNames = lastAsana.getTransitions();
    
    // Find matching asanas from the full asana list
    const matches = asanas.filter(asana => 
        transitionNames.includes(asana.name)
    );
    
    // Return all matching transitions (up to 2)
    return matches.slice(0, 2);
}

// Track current filter and search
let currentFilter = 'all';
let currentSearch = '';

// Add event listener for search input
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('asanaSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            currentSearch = e.target.value.toLowerCase();
            populateAsanaList();
        });
    }
});

// Filter asanas based on category
function filterAsanas(category) {
    console.log(`Filtering asanas by category: ${category}`);
    
    // Save current scroll position
    const asanaList = document.getElementById('asanaList');
    const scrollPosition = asanaList ? asanaList.scrollLeft : 0;
    
    // Update filter
    currentFilter = category;
    
    // Update active button
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        if (button.textContent.includes(category === 'all' ? 'All Poses' : category)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Repopulate the list with the filter
    populateAsanaList();
    
    // Restore scroll position after filtering
    if (asanaList) {
        setTimeout(() => {
            asanaList.scrollLeft = scrollPosition;
        }, 10);
    }
}

// Function to update recommended poses styling and animation
function updateRecommendedPoses() {
    const asanaList = document.getElementById('asanaList');
    if (!asanaList) return;

    // Get recommended poses
    const recommendedPoses = getRecommendedPoses();
    const hasRecommendations = recommendedPoses.length > 0;

    // Remove recommended class and highlight from all poses
    const allPoses = document.querySelectorAll('.asana-item');
    allPoses.forEach(pose => {
        pose.classList.remove('recommended', 'highlight');
    });

    if (hasRecommendations) {
        // Add recommended class to matching poses
        const recommendedEls = [];
        allPoses.forEach(pose => {
            const asanaName = pose.getAttribute('data-name');
            if (recommendedPoses.some(reco => reco.name === asanaName)) {
                pose.classList.add('recommended');
                recommendedEls.push(pose);
            }
        });

        // Add animation to recommended poses
        recommendedEls.forEach((el, index) => {
            // Scroll to make the first recommendation visible
            if (index === 0) {
                const recoBounds = el.getBoundingClientRect();
                const containerBounds = asanaList.getBoundingClientRect();
                
                // Only scroll if the recommended pose is not fully visible
                if (recoBounds.left < containerBounds.left || recoBounds.right > containerBounds.right) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
            
            // Add slight delay between each recommendation animation
            setTimeout(() => {
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 1500);
            }, index * 200);
        });

        console.log('Recommended poses:', recommendedPoses.map(p => p.name));
    }
}

// Populate the asana list with loaded asanas
function populateAsanaList() {
    console.log('Populating asana list with asanas:', asanas.length);
    
    const asanaList = document.getElementById('asanaList');
    if (!asanaList) {
        console.error("Asana list element not found");
        return;
    }
    
    // Clear the list
    asanaList.innerHTML = '';
    
    // Show loading message if no asanas yet
    if (asanas.length === 0) {
        asanaList.innerHTML = '<div class="loading-message">Loading asanas...</div>';
        return;
    }
    
    // Filter poses based on current category and search
    let posesList = [...asanas];
    
    // Apply category filter
    if (currentFilter !== 'all') {
        posesList = posesList.filter(asana => {
            return asana.tags && asana.tags.some(tag => 
                tag.toLowerCase().includes(currentFilter.toLowerCase())
            );
        });
    }
    
    // Apply search filter
    if (currentSearch) {
        posesList = posesList.filter(asana => {
            const nameMatch = asana.name.toLowerCase().includes(currentSearch);
            const sanskritMatch = asana.sanskrit && asana.sanskrit.toLowerCase().includes(currentSearch);
            return nameMatch || sanskritMatch;
        });
    }
    
    if (posesList.length === 0) {
        asanaList.innerHTML = `<div class="no-matches">No poses found matching your criteria</div>`;
        return;
    }
    
    // Create and add elements for each pose
    posesList.forEach((asana) => {
        const asanaElement = document.createElement('div');
        asanaElement.className = 'asana-item';
        asanaElement.draggable = true;
        asanaElement.setAttribute('data-name', asana.name);
        
        // Create difficulty badge
        const difficultyBadge = document.createElement('span');
        difficultyBadge.className = `difficulty-badge ${asana.difficulty.toLowerCase()}`;
        difficultyBadge.textContent = asana.difficulty;
        
        // Create image element
        const asanaImage = document.createElement('img');
        asanaImage.src = asana.image;
        asanaImage.alt = asana.name;
        
        // Add error handling for missing images
        asanaImage.onerror = function() {
            this.onerror = null;
            this.src = '';
            this.style.display = 'flex';
            this.style.justifyContent = 'center';
            this.style.alignItems = 'center';
            this.style.background = '#f5f5f5';
            this.style.fontSize = '30px';
            this.style.width = '120px';
            this.style.height = '120px';
            this.innerText = '🧘‍♀️';
            console.log(`Missing image for ${asana.name} in asana list`);
        };
        
        // Create name label - use Sanskrit if toggled
        const asanaName = document.createElement('p');
        if (typeof asana.getDisplayName === 'function') {
            asanaName.textContent = asana.getDisplayName(useSanskritNames);
        } else {
            asanaName.textContent = useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name;
        }
        
        // Append elements
        asanaElement.appendChild(difficultyBadge);
        asanaElement.appendChild(asanaImage);
        asanaElement.appendChild(asanaName);
        
        // Add event listener for click
        asanaElement.addEventListener('click', function() {
            selectAsana(asana);
        });
        
        // Add to list
        asanaList.appendChild(asanaElement);
    });
    
    console.log('Asana list populated with', posesList.length, 'asanas');
}

// Scrolling functions for the asana list
function scrollAsanaList(amount) {
    const asanaList = document.getElementById('asanaList');
    if (asanaList) {
        asanaList.scrollLeft += amount;
        updateScrollButtons();
    }
}

function updateScrollButtons() {
    const asanaList = document.getElementById('asanaList');
    const leftButton = document.querySelector('.scroll-btn.scroll-left');
    const rightButton = document.querySelector('.scroll-btn.scroll-right');
    
    if (!asanaList || !leftButton || !rightButton) return;
    
    // Show/hide left button based on scroll position
    leftButton.style.display = asanaList.scrollLeft > 0 ? 'block' : 'none';
    
    // Show/hide right button based on whether there's more content to scroll
    const hasMoreToScroll = asanaList.scrollLeft + asanaList.clientWidth < asanaList.scrollWidth;
    rightButton.style.display = hasMoreToScroll ? 'block' : 'none';
}

// Function to set up drag and drop functionality
function setupDragAndDrop() {
    console.log('Setting up drag and drop...');
    const flowTable = document.getElementById('flowTable');
    if (!flowTable) {
        console.error('Flow table not found for drag and drop setup');
        return;
    }
    
    // Rebind all drag-and-drop events
    // First remove any existing handlers to prevent duplicates
    flowTable.removeEventListener('dragstart', handleDragStart);
    flowTable.removeEventListener('dragenter', handleDragEnter);
    flowTable.removeEventListener('dragover', handleDragOver);
    flowTable.removeEventListener('dragleave', handleDragLeave);
    flowTable.removeEventListener('drop', handleDrop);
    flowTable.removeEventListener('dragend', handleDragEnd);
    
    // Now add fresh event listeners
    flowTable.addEventListener('dragstart', handleDragStart);
    flowTable.addEventListener('dragenter', handleDragEnter);
    flowTable.addEventListener('dragover', handleDragOver);
    flowTable.addEventListener('dragleave', handleDragLeave);
    flowTable.addEventListener('drop', handleDrop);
    flowTable.addEventListener('dragend', handleDragEnd);
    
    // Make sure all rows are properly draggable
    updateRowDragAttributes();
    
    console.log('Drag and drop setup complete');
}

// Ensures all rows have proper drag attributes
function updateRowDragAttributes() {
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-index', index);
        
        // Make sure first cell is styled as drag handle
        const firstCell = row.cells[0];
        if (firstCell) {
            firstCell.style.cursor = 'grab';
            firstCell.setAttribute('title', 'Drag to reorder');
        }
    });
}

// Drag and drop event handlers
function handleDragStart(e) {
    // Find the row being dragged - either the target itself or its parent row
    let row = null;
    
    if (e.target.tagName === 'TR') {
        row = e.target;
    } else {
        row = e.target.closest('tr');
        
        // Only allow drag from the first cell (position number)
        const cell = e.target.closest('td');
        if (!cell || cell.cellIndex !== 0) {
            e.preventDefault();
            return false;
        }
    }
    
    if (!row || row.rowIndex === 0) {
        e.preventDefault();
        return false; // Ignore header row
    }
    
    console.log('Drag started on row:', row.rowIndex);
    dragSource = row;
    row.classList.add('dragging');
    
    // Set the drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.rowIndex);
    
    // Make a ghost image that's more visible
    const dragImage = row.cloneNode(true);
    dragImage.style.width = row.offsetWidth + 'px';
    dragImage.style.height = row.offsetHeight + 'px';
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.backgroundColor = '#fff8f0';
    dragImage.style.border = '2px solid #ff8c00';
    document.body.appendChild(dragImage);
    
    // Use the custom drag image
    e.dataTransfer.setDragImage(dragImage, 20, 20);
    
    // Clean up the ghost after a short delay
    setTimeout(() => {
        document.body.removeChild(dragImage);
    }, 100);
}

function handleDragEnter(e) {
    // Ensure we're actually dragging something
    if (!dragSource) return;
    
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Ignore header row
    
    // Add visual feedback
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => r.classList.remove('drop-target'));
    
    if (row !== dragSource) {
        row.classList.add('drop-target');
    }
}

function handleDragOver(e) {
    if (!dragSource) return;
    
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    
    // Find the closest row
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Ignore header row
    
    // Add visual feedback to the row being hovered over
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => {
        if (r !== dragSource) {
            r.classList.remove('drop-target');
        }
    });
    
    if (row !== dragSource) {
        row.classList.add('drop-target');
    }
}

function handleDragLeave(e) {
    // Only remove the class if we're leaving the row entirely, not just moving between cells
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.target.contains(relatedTarget)) {
        const row = e.target.closest('tr');
        if (row) {
            row.classList.remove('drop-target');
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    // Check if we have a valid drag source
    if (!dragSource) {
        console.log('No valid drag source');
        return;
    }
    
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) {
        console.log('Invalid drop target (header or not a row)');
        return; // Ignore header row
    }
    
    console.log('Drop target row:', row.rowIndex);
    
    // Get source and target indices
    const sourceIndex = dragSource.rowIndex - 1; // Adjust for header row
    const targetIndex = row.rowIndex - 1; // Adjust for header row
    
    if (sourceIndex === targetIndex) {
        console.log('Source and target are the same, no action needed');
        return;
    }
    
    console.log('Moving asana from', sourceIndex, 'to', targetIndex);
    
    try {
        // Update the asanas array
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        editingFlow.asanas.splice(targetIndex, 0, movedAsana);
        
        // Rebuild the table
        rebuildFlowTable();
        
        // Update recommended poses based on the new last pose
        updateRecommendedPoses();
        
        // Ensure draggable attributes are set again
        setTimeout(updateRowDragAttributes, 0);
        
        // Add highlight animation to the moved row
        setTimeout(() => {
            const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
            const targetRow = rows[targetIndex];
            if (targetRow) {
                targetRow.classList.add('drag-highlight');
                setTimeout(() => {
                    targetRow.classList.remove('drag-highlight');
                }, 1500);
            }
        }, 50);
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    } catch (error) {
        console.error('Error during drop:', error);
    }
}

function handleDragEnd(e) {
    // Remove all drag styling
    document.querySelectorAll('#flowTable tr').forEach(row => {
        row.classList.remove('dragging', 'drop-target');
    });
    
    // Clear the drag source
    console.log('Drag operation ended');
    dragSource = null;
    
    // Re-setup drag and drop to ensure everything is bound correctly
    setTimeout(updateRowDragAttributes, 50);
}

function rebuildFlowTable() {
    const table = document.getElementById('flowTable');
    if (!table) return;
    
    // Clear the table except for the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    // Rebuild rows from editingFlow.asanas
    editingFlow.asanas.forEach((asana, index) => {
        if (!asana) return;
        
        const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
        
        const row = table.insertRow(-1);
        // Make the row element draggable for the drag event system to work
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-index', index);
        
        // Determine row number based on current sort order
        let rowNumber;
        if (tableInDescendingOrder) {
            rowNumber = editingFlow.asanas.length - index;
        } else {
            rowNumber = index + 1;
        }
        
        row.innerHTML = `
            <td title="Drag to reorder">${rowNumber}</td>
            <td>
                <div class="table-asana">
                    <img src="${asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}" 
                         onerror="this.onerror=null; this.src='images/webp/default-pose.webp'; this.style.display='flex'; this.style.justifyContent='center'; 
                         this.style.alignItems='center'; this.style.background='#f5f5f5'; this.style.fontSize='24px'; 
                         this.style.width='50px'; this.style.height='50px'; this.innerText='🧘‍♀️';">
                    <span>${typeof asana.getDisplayName === 'function' ? 
                            asana.getDisplayName(useSanskritNames) : 
                            (useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name)}</span>
                </div>
            </td>
            <td>
                <div class="duration-wrapper">
                    <input type="number" value="${asana.duration || 3}" min="1" max="300" onchange="updateFlowDuration()"/>
                    <span class="duration-unit">s</span>
                </div>
            </td>
            <td>${createSideDropdown(asana.side)}</td>
            <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
        `;
        
        // Add specific drag handle tooltip and style
        const numCell = row.cells[0];
        numCell.style.cursor = "grab";
    });
    
    // Make sure drag and drop works after rebuild by updating all row attributes
    updateRowDragAttributes();
    
    // Set up drag handlers again to ensure they work after rebuilding
    setupDragAndDrop();
    
    // Update flow duration
    updateFlowDuration();
    
    console.log('Rebuilt flow table with draggable rows');
}

// Function to toggle Sanskrit names
function toggleSanskritNames(event) {
    console.log("Toggle Sanskrit Names called");
    const globalToggle = document.getElementById('sanskrit-toggle-global');
    const buildToggle = document.getElementById('sanskrit-toggle-build');
    
    // Determine which toggle was changed directly from the event
    let sourceToggle = event ? event.target : null;
    
    if (!sourceToggle) {
        // If no event, try to determine from active element
        sourceToggle = document.activeElement === buildToggle ? buildToggle : 
                        document.activeElement === globalToggle ? globalToggle : buildToggle;
    }
    
    // Sync both toggles to match the source toggle
    if (globalToggle && buildToggle && sourceToggle) {
        if (sourceToggle === buildToggle) {
            globalToggle.checked = buildToggle.checked;
        } else {
            buildToggle.checked = globalToggle.checked;
        }
    }
    
    // Update the global state
    useSanskritNames = sourceToggle ? sourceToggle.checked : false;
    console.log("Sanskrit names toggled to:", useSanskritNames);
    
    // Save to localStorage
    localStorage.setItem('useSanskritNames', useSanskritNames);
    
    // Update UI elements that display pose names
    updateAsanaDisplayNames();
    
    // Repopulate the asana list to show the updated names
    if (currentScreenId === 'buildScreen') {
        populateAsanaList();
        
        // Force rebuild of the flow table
        if (editingFlow && editingFlow.asanas && editingFlow.asanas.length > 0) {
            rebuildFlowTable();
        }
    }
    
    // If in flow screen, update the current asana display
    if (currentScreenId === 'flowScreen' && editingFlow.asanas && editingFlow.asanas.length > 0) {
        updateAsanaDisplay(editingFlow.asanas[currentAsanaIndex]);
    }
    
    // Show a brief notification about the language change
    const message = useSanskritNames ? 'Showing Sanskrit Names' : 'Showing English Names';
    showToastNotification(message);
}

// Function to update displayed asana names throughout the UI
function updateAsanaDisplayNames() {
    // Update flow table if on build screen
    const flowTable = document.getElementById('flowTable');
    if (flowTable && flowTable.rows.length > 1) {
        // Skip header row (0) and update all asana names
        for (let i = 1; i < flowTable.rows.length; i++) {
            const row = flowTable.rows[i];
            const asanaCell = row.cells[1]; // Asana name cell
            if (asanaCell && asanaCell.querySelector('.table-asana span') && i-1 < editingFlow.asanas.length) {
                const asana = editingFlow.asanas[i-1];
                const nameSpan = asanaCell.querySelector('.table-asana span');
                nameSpan.textContent = asana.getDisplayName(useSanskritNames);
            }
        }
    }
}

// Initialize the app
function initializeApp() {
    loadAsanasFromXML()
        .then(() => {
            displayFlows();
            updateDate();
            
            // Set up drag and drop
            setupDragAndDrop();
            
            // Add window resize listener for scroll buttons
            window.addEventListener('resize', updateScrollButtons);
            
            // Initialize toggle buttons for Sanskrit names
            const globalSanskritToggle = document.getElementById('sanskrit-toggle-global');
            const buildSanskritToggle = document.getElementById('sanskrit-toggle-build');
            
            // Set initial state
            if (globalSanskritToggle) {
                globalSanskritToggle.checked = useSanskritNames;
                // Add event listener for global toggle
                globalSanskritToggle.addEventListener('change', toggleSanskritNames);
            }
            
            if (buildSanskritToggle) {
                buildSanskritToggle.checked = useSanskritNames;
                // Add event listener for build toggle
                buildSanskritToggle.addEventListener('change', toggleSanskritNames);
            }
            
            // Initialize the sort indicator to show the up arrow
            setTimeout(() => {
                const tableHeader = document.querySelector('#flowTable th:first-child');
                if (tableHeader) {
                    // Set initial class based on tableInDescendingOrder
                    tableHeader.classList.add(tableInDescendingOrder ? 'descending' : 'ascending');
                    tableHeader.title = tableInDescendingOrder 
                        ? 'Sorted by largest number first - Click to reverse'
                        : 'Sorted by smallest number first - Click to reverse';
                }
            }, 500); // Short delay to ensure DOM is ready
            
            console.log('App initialized successfully');
        })
        .catch(error => {
            console.error('Failed to initialize app:', error);
        });
    
    // Hide Sanskrit toggle on initial load (since we start on home screen)
    const sanskritToggle = document.querySelector('.sanskrit-toggle-global');
    if (sanskritToggle) {
        sanskritToggle.style.display = 'none';
    }
}

// Add event listener to initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Loaded - Initializing app with Sanskrit names:", useSanskritNames);
    initializeApp();
});