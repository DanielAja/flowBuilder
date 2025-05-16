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
    constructor(name, side, image, description, difficulty, tags, transitionsAsana, sanskrit = "", chakra = "") {
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
        this.chakra = chakra; // Store which chakra is associated with this pose
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
        this.sections = []; // Array to store user-created sections
        this.flowID = generateUniqueID();
        this.lastEdited = new Date().toISOString();
        this.lastFlowed = null; // Will be set when flow is practiced
    }
    
    // Add a new section to the flow
    addSection(name) {
        // Generate a unique ID for the section
        const sectionId = generateUniqueID();
        
        // Create a new section object
        const section = {
            id: sectionId,
            name: name,
            asanaIds: [] // Store IDs of asanas in this section
        };
        
        // Add the section to the flow
        this.sections.push(section);
        
        return sectionId;
    }
    
    // Get section by ID
    getSectionById(sectionId) {
        return this.sections.find(section => section.id === sectionId);
    }
    
    // Add an asana to a section
    addAsanaToSection(asanaIndex, sectionId) {
        const section = this.getSectionById(sectionId);
        if (section && !section.asanaIds.includes(asanaIndex)) {
            section.asanaIds.push(asanaIndex);
        }
    }
    
    // Remove an asana from a section
    removeAsanaFromSection(asanaIndex, sectionId) {
        const section = this.getSectionById(sectionId);
        if (section) {
            section.asanaIds = section.asanaIds.filter(id => id !== asanaIndex);
        }
    }
    
    // Get asanas in a section
    getAsanasInSection(sectionId) {
        const section = this.getSectionById(sectionId);
        if (!section) return [];
        
        return section.asanaIds.map(index => {
            return {
                asana: this.asanas[index],
                index: index
            };
        }).filter(item => item.asana); // Filter out undefined asanas
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
let currentViewMode = localStorage.getItem('viewMode') || 'table'; // Default to table view
let confettiAnimationId = null; // For tracking confetti animation

// Global variable to store copied poses
let copiedPoses = [];

// Global variable to store imported flow (temporary storage)
let importedFlow = null;

// Variable to store the controls show handler
let showControlsHandler;

// Setup auto-hide for flow controls
function setupFlowControlsAutoHide() {
    const flowControls = document.querySelector('.flow-controls-global');
    if (!flowControls) return;
    
    // Add styles to enable transition
    flowControls.style.transition = 'opacity 0.5s ease';
    flowControls.style.opacity = '1';
    
    // Variable to track the timeout
    let hideTimeout;
    
    // Function to show controls
    showControlsHandler = () => {
        // Clear any existing timeout
        clearTimeout(hideTimeout);
        
        // Show controls
        flowControls.style.opacity = '1';
        flowControls.style.pointerEvents = 'auto';
        
        // Set timeout to hide after 7 seconds
        hideTimeout = setTimeout(() => {
            flowControls.style.opacity = '0';
            flowControls.style.pointerEvents = 'none';
        }, 7000);
    };
    
    // Initial show and hide
    showControlsHandler();
    
    // Add event listeners for touch and click
    document.addEventListener('click', showControlsHandler);
    document.addEventListener('touchstart', showControlsHandler);
}

// Clean up event listeners for flow controls
function cleanupFlowControlsAutoHide() {
    if (showControlsHandler) {
        document.removeEventListener('click', showControlsHandler);
        document.removeEventListener('touchstart', showControlsHandler);
        showControlsHandler = null;
    }
}

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

    // Reset any previous animation classes on the asana name
    if (asanaNameElement) {
        asanaNameElement.classList.remove('flow-complete-message');
    }

    // Use the displayName based on the current language toggle setting
    // We directly read the toggle state to ensure the most current value is used
    const sanskritToggleGlobal = document.getElementById('sanskrit-toggle-global');
    const currentUseSanskritNames = sanskritToggleGlobal ? sanskritToggleGlobal.checked : useSanskritNames;
    
    if (asanaNameElement) {
        // Handle cases where getDisplayName might not exist
        if (typeof asana.getDisplayName === 'function') {
            asanaNameElement.textContent = asana.getDisplayName(currentUseSanskritNames);
        } else {
            // Fallback to using name or sanskrit based on toggle
            asanaNameElement.textContent = currentUseSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name;
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
            
            // Use the same sanskritToggleGlobal value for consistency
            // Handle cases where getDisplayName might not exist
            if (typeof nextAsana.getDisplayName === 'function') {
                nextAsanaNameElement.textContent = nextAsana.getDisplayName(currentUseSanskritNames);
            } else {
                // Fallback to using name or sanskrit based on toggle
                nextAsanaNameElement.textContent = currentUseSanskritNames && nextAsana.sanskrit ? nextAsana.sanskrit : nextAsana.name;
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
    return asana.duration || 15; // Default to 15 seconds if not set
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
    // Remove flow-mode class when changing screens
    document.body.classList.remove('flow-mode');
    
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

        // Update the save button text
        const saveButton = document.querySelector('#buildScreen > div.build-content > div.language-toggle-container > button.save-flow-btn');
        if (saveButton) {
            saveButton.textContent = 'Done';
        }

        // Sync build screen Sanskrit toggle state
        const sanskritToggleBuild = document.getElementById('sanskrit-toggle-build');
        if (sanskritToggleBuild) {
            sanskritToggleBuild.checked = useSanskritNames;
        }
        
        // Clear the asana search input
        const asanaSearch = document.getElementById('asanaSearch');
        if (asanaSearch) {
            asanaSearch.value = '';
            currentSearch = ''; // Reset the current search state
        }

        // Reset the asana list
        const asanaList = document.getElementById('asanaList');
        if (asanaList) {
            asanaList.innerHTML = '';
            // Reset filter and search states
            currentFilter = 'all';
            currentSearch = '';
            // Repopulate the list with all asanas
            populateAsanaList();
            // Reset scroll position to the beginning
            asanaList.scrollLeft = 0;
        }

        // Reset the flow table
        const flowTable = document.getElementById('flowTable');
        if (flowTable) {
            // Clear existing rows except header
            while (flowTable.rows.length > 1) {
                flowTable.deleteRow(1);
            }
        }

        // Reset category buttons to "All Poses"
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(button => {
            if (button.textContent.includes('All Poses')) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
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
        
        // Add flow-mode class to prevent scrolling
        document.body.classList.add('flow-mode');
        
        // Setup auto-hide functionality for flow controls
        setupFlowControlsAutoHide();
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
        asana.sanskrit,
        asana.chakra || ""
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
    // Check for empty values and set to 15 seconds
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
    // Check if the button is in a card or table row
    const card = button.closest('.flow-card');
    const row = button.closest('tr');
    let dataIndex;

    if (card) {
        // Card view
        dataIndex = parseInt(card.getAttribute('data-index'));

        // Prevent interactions during animation
        card.style.pointerEvents = 'none';
        button.style.pointerEvents = 'none';

        // Add removal animation
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        card.style.transition = 'all 0.3s ease-out';

        // Short delay to allow animation to complete
        setTimeout(() => {
            // Remove from array if index is valid
            if (!isNaN(dataIndex) && dataIndex >= 0 && dataIndex < editingFlow.asanas.length) {
                editingFlow.asanas.splice(dataIndex, 1);

                // Rebuild the entire view to ensure proper order and numbering
                rebuildFlowTable();

                // Update flow duration
                updateFlowDuration();

                // Refresh the asana list to update recommended poses
                populateAsanaList();
            }
        }, 300);
        return; // End the function here for card view
    } else if (row) {
        // Table view
        const table = document.getElementById("flowTable");
        if (!table) return;

        const rowIndex = row.rowIndex;

        // Get the data-index attribute to find the actual array index
        dataIndex = parseInt(row.getAttribute('data-index'));

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
    } else {
        console.error('Remove button not in a card or table row');
    }
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
        const userChoice = confirm('Would you like to add a title to save this flow, or return home without saving?\n\nClick OK to return home\nClick Cancel to add a title');
        if (userChoice) {
            // User clicked OK - return home without saving
            changeScreen('homeScreen');
            editingFlow = new Flow();
            editMode = false;
            return;
        } else {
            // User clicked Cancel - focus the title input
            const titleInput = document.getElementById('title');
            if (titleInput) {
                titleInput.focus();
            }
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
                    <button class="share-btn" onclick="showShareFlow('${flow.flowID}')" title="Share this flow"></button>
                    <button class="edit-btn" onclick="editFlow('${flow.flowID}')" title="Edit this flow"></button>
                    <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')" title="Delete this flow"></button>
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
                asana.sanskrit || "",
                asana.chakra || ""
            );
            newAsana.setDuration(asana.duration || 15);
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

        // Reset any animation classes on the title elements
        const asanaName = document.getElementById('asanaName');
        if (asanaName) {
            asanaName.classList.remove('flow-complete-message');
            asanaName.style.animation = '';
        }

        const asanaSide = document.getElementById('asanaSide');
        if (asanaSide) {
            asanaSide.style.fontSize = '';
            asanaSide.style.color = '';
        }

        // Get the first asana
        const asana = editingFlow.asanas[currentAsanaIndex];
        console.log("First asana:", asana.name, "Duration:", asana.duration);

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

            // Set up a 3-second countdown before starting the flow
            const asanaName = document.getElementById('asanaName');
            const asanaSide = document.getElementById('asanaSide');
            const asanaImage = document.getElementById('asanaImage');
            const originalAsanaName = asanaName.textContent;
            const originalAsanaSide = asanaSide.textContent;
            const originalImageSrc = asanaImage.src;

            // Save original image source for later
            const originalNextAsanaImage = document.getElementById('nextAsanaImage');
            const originalNextImageSrc = originalNextAsanaImage ? originalNextAsanaImage.src : '';

            // Change display to show countdown starting and add animation
            asanaName.textContent = "Get Ready";
            asanaName.style.animation = 'pulse 1.5s infinite';

            // Add the pulse animation if it doesn't exist
            if (!document.getElementById('countdown-animations')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'countdown-animations';
                styleEl.textContent = `
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                `;
                document.head.appendChild(styleEl);
            }

            asanaSide.textContent = "Starting in 3";

            // Replace image with countdown number
            asanaImage.style.display = 'none';

            // Create and add a countdown number display to the image container
            const asanaImageContainer = document.querySelector('.asana-image-container');
            const countdownDisplay = document.createElement('div');
            countdownDisplay.id = 'countdown-display';
            countdownDisplay.textContent = '3';

            // Create a circular container with white gradient
            const circleContainer = document.createElement('div');
            circleContainer.style.position = 'absolute';
            circleContainer.style.top = '50%';
            circleContainer.style.left = '50%';
            circleContainer.style.transform = 'translate(-50%, -50%)';
            circleContainer.style.width = '250px';
            circleContainer.style.height = '250px';
            circleContainer.style.borderRadius = '50%';
            circleContainer.style.background = 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0) 100%)';
            circleContainer.style.display = 'flex';
            circleContainer.style.justifyContent = 'center';
            circleContainer.style.alignItems = 'center';
            circleContainer.style.boxShadow = '0 0 30px rgba(255, 140, 0, 0.3)';
            circleContainer.style.zIndex = '5';
            circleContainer.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
            circleContainer.style.opacity = '0';
            circleContainer.style.transform = 'translate(-50%, -50%) scale(0.5)';
            circleContainer.style.border = '2px solid rgba(255, 140, 0, 0.3)';

            // Apply stylish styling to the countdown
            countdownDisplay.style.fontSize = '150px';
            countdownDisplay.style.fontWeight = 'bold';
            countdownDisplay.style.color = '#ff8c00';
            countdownDisplay.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.7)';
            countdownDisplay.style.position = 'relative';
            countdownDisplay.style.zIndex = '10';
            countdownDisplay.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';

            // Add countdown to the circle container
            circleContainer.appendChild(countdownDisplay);

            // Add the circle container to the image container
            asanaImageContainer.appendChild(circleContainer);

            // Trigger the animation after a slight delay
            setTimeout(() => {
                circleContainer.style.opacity = '1';
                circleContainer.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 50);

            // Hide the "Coming Up" section during countdown
            const comingUpSection = document.querySelector('.coming-up');
            if (comingUpSection) {
                comingUpSection.style.visibility = 'hidden';
            }

            countdownContainer.innerHTML = `
                <svg class="countdown-svg" viewBox="0 0 100 100">
                    <circle r="45" cx="50" cy="50" fill="transparent" stroke="#ddd" stroke-width="10"></circle>
                    <circle id="countdown-circle" r="45" cx="50" cy="50" fill="transparent"
                            stroke="#ff8c00" stroke-width="10" stroke-dasharray="282.7"
                            stroke-dashoffset="0" transform="rotate(-90 50 50)"></circle>
                </svg>
                <div id="countdown">3</div>
            `;

            // Clear any existing animation frame/timer
            if (animationFrameId) {
                clearTimeout(animationFrameId);
                animationFrameId = null;
            }

            // Start 3-second countdown
            let startCountdown = 3;
            const startTimer = setInterval(() => {
                startCountdown--;
                const countdownElement = document.getElementById('countdown');
                if (countdownElement) {
                    countdownElement.textContent = startCountdown;
                }

                // Update the large countdown display in the image container with animation
                const countdownDisplay = document.getElementById('countdown-display');
                if (countdownDisplay) {
                    // Add pulse animation to the circle container
                    const circleContainer = countdownDisplay.parentElement;
                    if (circleContainer) {
                        // Apply animations to the circle
                        circleContainer.style.transform = 'translate(-50%, -50%) scale(1.1)';
                        setTimeout(() => {
                            circleContainer.style.transform = 'translate(-50%, -50%) scale(1)';
                        }, 300);

                        // Change the background color based on countdown number - keeping white gradient but with different borders
                        const colors = {
                            2: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0) 100%)',
                            1: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0) 100%)',
                            0: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0) 100%)'
                        };

                        // Border colors for each step
                        const borderColors = {
                            2: '2px solid rgba(255, 140, 0, 0.6)',
                            1: '2px solid rgba(255, 0, 0, 0.6)',
                            0: '2px solid rgba(0, 200, 0, 0.6)'
                        };

                        // Apply border color
                        if (borderColors[startCountdown]) {
                            circleContainer.style.border = borderColors[startCountdown];
                        }

                        // Keep text color constant - using the orange theme color
                        countdownDisplay.style.color = '#ff8c00';

                        if (colors[startCountdown]) {
                            circleContainer.style.background = colors[startCountdown];
                        }
                    }

                    // Apply exit animation
                    countdownDisplay.style.opacity = '0';

                    // Set new number and apply entrance animation after short delay
                    setTimeout(() => {
                        countdownDisplay.textContent = startCountdown;

                        // Slight delay before entrance animation
                        setTimeout(() => {
                            countdownDisplay.style.opacity = '1';
                        }, 50);
                    }, 250);
                }

                asanaSide.textContent = "Starting in " + startCountdown;

                // Update circle animation
                const countdownCircle = document.getElementById('countdown-circle');
                if (countdownCircle) {
                    const circumference = 2 * Math.PI * 45;
                    const progress = startCountdown / 3;
                    const dashOffset = circumference * (1 - progress);
                    countdownCircle.style.strokeDasharray = circumference;
                    countdownCircle.style.strokeDashoffset = dashOffset;
                }

                if (startCountdown <= 0) {
                    clearInterval(startTimer);

                    // Animate the countdown display and circle container out with a final animation
                    const countdownDisplay = document.getElementById('countdown-display');
                    if (countdownDisplay) {
                        // Get the circle container
                        const circleContainer = countdownDisplay.parentElement;

                        if (circleContainer) {
                            // Add a celebratory animation to the circle
                            circleContainer.style.transform = 'translate(-50%, -50%) scale(1.5)';
                            circleContainer.style.opacity = '0';
                            circleContainer.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';

                            // Remove after animation completes
                            setTimeout(() => {
                                circleContainer.remove();
                            }, 800);
                        } else {
                            // Fallback in case the circle container isn't found
                            countdownDisplay.style.opacity = '0';
                            countdownDisplay.style.transform = 'scale(2)';

                            // Remove after animation completes
                            setTimeout(() => {
                                countdownDisplay.remove();
                            }, 500);
                        }
                    }

                    // Show the asana image again
                    const asanaImage = document.getElementById('asanaImage');
                    if (asanaImage) {
                        asanaImage.style.display = '';
                    }

                    // Show the "Coming Up" section again
                    const comingUpSection = document.querySelector('.coming-up');
                    if (comingUpSection) {
                        comingUpSection.style.visibility = '';
                    }

                    // Reset any animation on the asana name
                    asanaName.style.animation = '';

                    // Update the display and get the duration for the first asana
                    const duration = updateAsanaDisplay(asana);
                    console.log("Display updated, duration:", duration);

                    // Update countdown display for the actual asana
                    if (countdownContainer) {
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

                    // Start the actual flow timer
                    setTimeout(() => {
                        console.log("Starting countdown timer for first asana");
                        startCountdownTimer(duration);
                    }, 100);
                }
            }, 1000);
        }
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
    
    // Reset the countdown animation with the new duration
    countdownCircle.style.strokeDasharray = circumference;
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
                // Calculate the progress (0 to 1) and multiply by circumference
                const progress = timeLeft / duration;
                const dashOffset = circumference * (1 - progress);
                countdownCircle.style.strokeDashoffset = dashOffset;
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
                    
                    // Clear the existing timer before starting a new one
                    if (animationFrameId) {
                        clearTimeout(animationFrameId);
                        animationFrameId = null;
                    }
                    
                    // Reset the circle animation
                    if (countdownCircle) {
                        countdownCircle.style.strokeDasharray = circumference;
                        countdownCircle.style.strokeDashoffset = "0";
                    }
                    
                    // Start a new timer with the next asana's duration
                    setTimeout(() => {
                        startCountdownTimer(nextDuration);
                    }, 100);
                } else {
                    console.log("End of flow reached!");

                    // Trigger confetti animation to celebrate completion
                    createConfetti();

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

                    // Show congratulations message with special styling
                    const asanaName = document.getElementById('asanaName');
                    if (asanaName) {
                        asanaName.textContent = "Flow Complete!";
                        asanaName.classList.add('flow-complete-message');
                    }

                    const asanaSide = document.getElementById('asanaSide');
                    if (asanaSide) {
                        asanaSide.textContent = "";
                        asanaSide.style.fontSize = "1.5rem";
                        asanaSide.style.color = "#333";
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

// Function to create and animate confetti
function createConfetti() {
    // Stop any existing confetti animation
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }

    // Remove any existing canvas
    const existingCanvas = document.getElementById('confetti-canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    // Create a canvas for the confetti
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1000';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // Confetti configuration
    const confettiCount = 200;
    const confettiColors = ['#ff8c00', '#ffd700', '#00bfff', '#ff1493', '#32cd32', '#7b68ee'];
    const confetti = [];

    // Create confetti pieces
    for (let i = 0; i < confettiCount; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            rotation: Math.random() * 2 * Math.PI,
            rotationSpeed: Math.random() * 0.2 - 0.1,
            speedX: Math.random() * 5 - 2.5,
            speedY: Math.random() * 5 + 7,
            shape: Math.random() > 0.5 ? 'circle' : 'rect'
        });
    }

    // Animate confetti
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let stillActive = false;

        confetti.forEach(piece => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation);

            ctx.fillStyle = piece.color;
            if (piece.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, piece.size / 2, 0, 2 * Math.PI);
                ctx.fill();
            } else {
                ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
            }

            ctx.restore();

            // Update position
            piece.x += piece.speedX;
            piece.y += piece.speedY;
            piece.rotation += piece.rotationSpeed;

            // Check if this piece is still active
            if (piece.y < canvas.height + piece.size) {
                stillActive = true;
            }
        });

        // Continue animation if there are active confetti pieces
        if (stillActive) {
            confettiAnimationId = requestAnimationFrame(animateConfetti);
        } else {
            // Clean up when all confetti is off-screen
            if (canvas) {
                canvas.remove();
            }
            confettiAnimationId = null;
        }
    }

    // Start animation
    confettiAnimationId = requestAnimationFrame(animateConfetti);

    // Set timeout to remove confetti after 5 seconds (optional)
    setTimeout(() => {
        if (confettiAnimationId) {
            cancelAnimationFrame(confettiAnimationId);
            confettiAnimationId = null;
        }
        if (canvas) {
            canvas.remove();
        }
    }, 5000);
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

        // Clean up flow controls event listeners
        cleanupFlowControlsAutoHide();

        // Return to home screen
        changeScreen('homeScreen');
    }
}

// Function to export a flow as a shareable string
function exportFlow(flowID) {
    // Get all flows from storage
    const flows = getFlows();

    // Find the flow with the given ID
    const flowToExport = flows.find(flow => flow.flowID === flowID);

    if (!flowToExport) {
        console.error(`Flow with ID ${flowID} not found`);
        return null;
    }

    try {
        // Create a simplified version of the flow for sharing
        // We exclude some properties that aren't needed for sharing
        const exportData = {
            name: flowToExport.name,
            description: flowToExport.description,
            time: flowToExport.time,
            peakPose: flowToExport.peakPose,
            asanas: flowToExport.asanas.map(asana => ({
                name: asana.name,
                sanskrit: asana.sanskrit || "",
                side: asana.side,
                image: asana.image,
                description: asana.description,
                difficulty: asana.difficulty,
                tags: asana.tags || [],
                transitionsAsana: asana.transitionsAsana || [],
                duration: asana.duration || 7,
                chakra: asana.chakra || ""
            })),
            timestamp: new Date().toISOString(),
            version: "1.0" // For future compatibility
        };

        // Convert to JSON string and encode as base64
        const jsonStr = JSON.stringify(exportData);
        // Use btoa for base64 encoding (it's built into browsers)
        const encoded = btoa(jsonStr);

        return encoded;
    } catch (error) {
        console.error('Error exporting flow:', error);
        return null;
    }
}

// Function to import a flow from a shareable string
function importFlow(shareCode) {
    try {
        // Decode the base64 string
        const jsonStr = atob(shareCode);

        // Parse the JSON
        const importData = JSON.parse(jsonStr);

        // Validate the imported data has the minimum required fields
        if (!importData.name || !Array.isArray(importData.asanas)) {
            throw new Error("Invalid flow data");
        }

        // Create a new Flow object
        const newFlow = new Flow(
            importData.name,
            importData.description || "",
            importData.time || 0,
            importData.peakPose || ""
        );

        // Generate a new ID for this flow
        newFlow.flowID = generateUniqueID();
        newFlow.lastEdited = new Date().toISOString();

        // Add each asana to the flow
        importData.asanas.forEach(asana => {
            const newAsana = new YogaAsana(
                asana.name,
                asana.side,
                asana.image,
                asana.description,
                asana.difficulty,
                asana.tags || [],
                asana.transitionsAsana || [],
                asana.sanskrit || "",
                asana.chakra || ""
            );
            newAsana.setDuration(asana.duration || 7);
            newFlow.addAsana(newAsana);
        });

        // Calculate total duration
        newFlow.calculateTotalDuration();

        return newFlow;
    } catch (error) {
        console.error('Error importing flow:', error);
        return null;
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
                    asana.sanskrit || "",
                    asana.chakra || ""
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
                asana.sanskrit || "",
                asana.chakra || ""
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

// Show the share flow modal with export code
function showShareFlow(flowID) {
    // Generate the share code for the flow
    const shareCode = exportFlow(flowID);

    if (!shareCode) {
        alert('Error generating share code. Please try again.');
        return;
    }

    // Get the modal and share code output elements
    const modal = document.getElementById('shareFlowModal');
    const shareCodeOutput = document.getElementById('shareCodeOutput');

    // Set the share code in the textarea
    if (shareCodeOutput) {
        shareCodeOutput.value = shareCode;
    }

    // Hide any copy confirmation message
    const copyConfirmation = document.getElementById('copyConfirmation');
    if (copyConfirmation) {
        copyConfirmation.style.display = 'none';
    }

    // Show the modal
    if (modal) {
        modal.style.display = 'block';
    }
}

// Copy the share code to clipboard
function copyShareCode() {
    const shareCodeOutput = document.getElementById('shareCodeOutput');
    const copyConfirmation = document.getElementById('copyConfirmation');

    if (shareCodeOutput && copyConfirmation) {
        // Select the text
        shareCodeOutput.select();

        try {
            // Execute copy command
            document.execCommand('copy');

            // Show confirmation
            copyConfirmation.style.display = 'block';

            // Hide confirmation after 3 seconds
            setTimeout(() => {
                copyConfirmation.style.display = 'none';
            }, 3000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy to clipboard. Please select and copy the text manually.');
        }
    }
}

// Close the share modal
function closeShareModal() {
    const modal = document.getElementById('shareFlowModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show the import flow modal
function showImportFlow() {
    // Get the modal and import code input elements
    const modal = document.getElementById('importFlowModal');
    const importCodeInput = document.getElementById('importCodeInput');

    // Clear any previous input and error messages
    if (importCodeInput) {
        importCodeInput.value = '';
    }

    const importError = document.getElementById('importError');
    if (importError) {
        importError.style.display = 'none';
    }

    // Show the modal
    if (modal) {
        modal.style.display = 'block';
    }
}

// Process the import flow action
function processImportFlow() {
    const importCodeInput = document.getElementById('importCodeInput');
    const importError = document.getElementById('importError');

    if (!importCodeInput || !importError) {
        console.error('Import elements not found');
        return;
    }

    const shareCode = importCodeInput.value.trim();

    if (!shareCode) {
        importError.style.display = 'block';
        return;
    }

    try {
        // Try to import the flow
        const newFlow = importFlow(shareCode);

        if (!newFlow) {
            importError.style.display = 'block';
            return;
        }

        // Get existing flows
        const flows = getFlows();

        // Check if a flow with the same name already exists
        const existingNameIndex = flows.findIndex(flow => flow.name === newFlow.name);
        if (existingNameIndex !== -1) {
            // Append a suffix to make the name unique
            newFlow.name = `${newFlow.name} (Imported)`;
        }

        // Add new flow to storage
        flows.push(newFlow);
        saveFlows(flows);

        // Close the modal
        closeImportModal();

        // Refresh the flow list
        displayFlows();

        // Show success message
        alert(`Flow "${newFlow.name}" has been imported successfully!`);

    } catch (error) {
        console.error('Error importing flow:', error);
        importError.style.display = 'block';
    }
}

// Close the import modal
function closeImportModal() {
    const modal = document.getElementById('importFlowModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to toggle the table sort order
function sortTableByLargestNumber() {
    const table = document.getElementById('flowTable');
    if (!table) return;
    
    // Toggle the sort order
    tableInDescendingOrder = !tableInDescendingOrder;
    
    // Rebuild the flow table with the new sort order
    // Our rebuildTableView function will handle the ordering
    // of poses and groups according to the tableInDescendingOrder value
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
            tableHeader.innerHTML = '#';
            tableHeader.title = 'Sorted by largest number first - Click to reverse';
            
            // Show a brief animated toast notification
            showToastNotification('Sorted: Largest First');
        } else {
            // Add ascending class and update header content
            tableHeader.classList.add('ascending');
            tableHeader.innerHTML = '#';
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
            const chakra = asanaElem.getElementsByTagName('chakra')[0]?.textContent || '';
            
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
                sanskrit,
                chakra
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
                "Adho Mukha Svanasana",
                "Third Eye"
            ),
            new YogaAsana(
                "Tree Pose",
                "Right",
                "images/webp/tree-pose.webp",
                "Tree Pose is a standing pose that improves balance and concentration. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Balance"],
                ["Mountain Pose", "Warrior 3"],
                "Vrksasana",
                "Root"
            ),
            new YogaAsana(
                "Warrior 2",
                "Right",
                "images/webp/warrior-2.webp",
                "Warrior 2 is a standing pose that strengthens the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Strength"],
                ["Mountain Pose", "Triangle Pose"],
                "Virabhadrasana II",
                "Sacral"
            ),
            new YogaAsana(
                "Triangle Pose",
                "Right",
                "images/triangle-pose.webp",
                "Triangle Pose is a standing pose that stretches the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Stretch"],
                ["Warrior 2", "Half Moon Pose"],
                "Trikonasana",
                "Sacral"
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
        let previousResults = [];
        
        searchInput.addEventListener('input', function(e) {
            const newSearch = e.target.value.toLowerCase();
            
            // Get current displayed poses before applying new search
            const asanaList = document.getElementById('asanaList');
            const currentPoses = Array.from(asanaList.querySelectorAll('.asana-item')).map(item => item.getAttribute('data-name'));
            
            // Apply the new search
            currentSearch = newSearch;
            
            // Get new filtered results
            let newResults = [...asanas];
            if (currentFilter !== 'all') {
                newResults = newResults.filter(asana => {
                    return asana.tags && asana.tags.some(tag => 
                        tag.toLowerCase().includes(currentFilter.toLowerCase())
                    );
                });
            }
            if (newSearch) {
                newResults = newResults.filter(asana => {
                    const nameMatch = asana.name.toLowerCase().includes(newSearch);
                    const sanskritMatch = asana.sanskrit && asana.sanskrit.toLowerCase().includes(newSearch);
                    return nameMatch || sanskritMatch;
                });
            }
            
            // Compare new results with previous results
            const newResultNames = newResults.map(asana => asana.name);
            const previousResultNames = previousResults.map(asana => asana.name);
            
            // Only update if results have changed
            if (JSON.stringify(newResultNames) !== JSON.stringify(previousResultNames)) {
                // Update previous results
                previousResults = newResults;
                
                // Populate the list with new results
                populateAsanaList();
            }
        });
    }
});

// Filter asanas based on category
function filterAsanas(category) {
    // Update current filter
    currentFilter = category;

    // Update active button class
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        // Remove active class from all buttons
        button.classList.remove('active');
        
        // Add active class to the clicked button
        if (button.textContent.trim() === 'All Poses' && category === 'all') {
            button.classList.add('active');
        } else if (button.textContent.trim() === category) {
            button.classList.add('active');
        }
    });

    // Use populateAsanaList to handle both filtering and searching
    populateAsanaList();
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
    
    // Get current displayed poses before clearing
    const currentPoses = Array.from(asanaList.querySelectorAll('.asana-item')).map(item => item.getAttribute('data-name'));
    
    // Clear the list
    asanaList.innerHTML = '';
    
    // Show loading message if no asanas yet
    if (asanas.length === 0) {
        asanaList.innerHTML = '<div class="loading-message">Loading asanas...</div>';
        return;
    }
    
    // Get sequences first
    const sequences = getSequences();
    
    // Filter poses based on current category and search
    let posesList = [...asanas];
    
    // Apply category filter
    if (currentFilter === 'Sequence') {
        // If Sequence is selected, only show sequences
        posesList = [];
    } else if (currentFilter !== 'all') {
        posesList = posesList.filter(asana => {
            return asana.tags && asana.tags.some(tag => 
                tag.toLowerCase().includes(currentFilter.toLowerCase())
            );
        });
    }
    
    // Apply search filter
    if (currentSearch) {
        posesList = posesList.filter(asana => {
            const displayName = asana.getDisplayName(useSanskritNames);
            const nameMatch = displayName.toLowerCase().includes(currentSearch);
            const sanskritMatch = asana.sanskrit && asana.sanskrit.toLowerCase().includes(currentSearch);
            return nameMatch || sanskritMatch;
        });
    }
    
    // Show no matches message if both poses and sequences are empty
    if (posesList.length === 0 && (!sequences || sequences.length === 0)) {
        asanaList.innerHTML = `<div class="no-matches">No poses found 🧘‍♂️</div>`;
        return;
    }
    
    // Create and add elements for each pose if not in Sequence filter
    if (currentFilter !== 'Sequence') {
        posesList.forEach((asana, index) => {
            const asanaElement = document.createElement('div');
            asanaElement.className = 'asana-item';
            asanaElement.draggable = true;
            asanaElement.setAttribute('data-name', asana.name);
            asanaElement.setAttribute('data-tags', asana.tags.join(','));
            
            // Create difficulty badge
            const difficultyBadge = document.createElement('span');
            difficultyBadge.className = `difficulty-badge ${asana.difficulty.toLowerCase()}`;
            difficultyBadge.textContent = asana.difficulty;
            
            // Create image container (for positioning the chakra indicator)
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.style.display = 'inline-block';

            // Create image element
            const asanaImage = document.createElement('img');
            asanaImage.src = asana.image;
            asanaImage.alt = asana.getDisplayName(useSanskritNames);

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
                console.log(`Missing image for ${asana.getDisplayName(useSanskritNames)} in asana list`);
            };

            // Add chakra indicator if the pose has chakra information
            if (asana.chakra) {
                const chakraIndicator = document.createElement('div');
                chakraIndicator.className = 'chakra-indicator';

                // Add the specific chakra class based on the chakra name
                const chakraClass = asana.chakra.toLowerCase().includes('root') ? 'chakra-root' :
                                   asana.chakra.toLowerCase().includes('sacral') ? 'chakra-sacral' :
                                   asana.chakra.toLowerCase().includes('solar') ? 'chakra-solar' :
                                   asana.chakra.toLowerCase().includes('heart') ? 'chakra-heart' :
                                   asana.chakra.toLowerCase().includes('throat') ? 'chakra-throat' :
                                   asana.chakra.toLowerCase().includes('third') ? 'chakra-third-eye' :
                                   asana.chakra.toLowerCase().includes('crown') ? 'chakra-crown' : '';

                if (chakraClass) {
                    chakraIndicator.classList.add(chakraClass);
                    chakraIndicator.title = `${asana.chakra} Chakra`;
                    imgContainer.appendChild(chakraIndicator);
                }
            }

            imgContainer.appendChild(asanaImage);
            
            // Create name label - use getDisplayName for consistent naming
            const asanaName = document.createElement('p');
            asanaName.textContent = asana.getDisplayName(useSanskritNames);
            
            // Append elements
            asanaElement.appendChild(difficultyBadge);
            asanaElement.appendChild(imgContainer);
            asanaElement.appendChild(asanaName);
            
            // Add event listener for click
            asanaElement.addEventListener('click', function() {
                selectAsana(asana);
            });
            
            // Add to list
            asanaList.appendChild(asanaElement);
        });
    }
    
    // Filter sequences based on search if needed
    let filteredSequences = sequences;
    if (currentSearch) {
        filteredSequences = sequences.filter(sequence => 
            sequence.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
            sequence.poses.some(pose => 
                pose.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
                (pose.sanskrit && pose.sanskrit.toLowerCase().includes(currentSearch.toLowerCase()))
            )
        );
    }
    
    // Add sequences if we're showing all poses or specifically filtering for sequences
    if (currentFilter === 'all' || currentFilter === 'Sequence') {
        // Add saved sequences to the list
        filteredSequences.forEach((sequence, index) => {
            // Create sequence element styled like asana-item
            const sequenceElement = document.createElement('div');
            sequenceElement.className = 'asana-item';
            sequenceElement.draggable = true;
            sequenceElement.setAttribute('data-sequence-id', sequence.id);
            
            // Add animation delay if not previously displayed
            sequenceElement.style.animationDelay = `${(posesList.length + index) * 0.05}s`;
            
            // Create a container for sequence preview images
            const imageContainer = document.createElement('div');
            imageContainer.className = 'sequence-preview-container';
            imageContainer.style.display = 'flex';
            imageContainer.style.justifyContent = 'center';
            imageContainer.style.position = 'relative';
            imageContainer.style.height = '85px';
            imageContainer.style.width = '100%';
            
            // Add up to 3 preview images from the sequence
            const maxPreviewImages = Math.min(3, sequence.poses.length);
            for (let i = 0; i < maxPreviewImages; i++) {
                const pose = sequence.poses[i];
                const previewImg = document.createElement('img');
                previewImg.src = pose.image;
                previewImg.alt = pose.name;
                previewImg.style.width = '60px';
                previewImg.style.height = '60px';
                previewImg.style.objectFit = 'contain';
                previewImg.style.position = 'absolute';
                previewImg.style.borderRadius = '50%';
                previewImg.style.background = 'white';
                previewImg.style.padding = '2px';
                previewImg.style.border = '1px solid #eee';
                previewImg.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                previewImg.style.transition = 'all 0.3s ease';
                
                // Position each image (staggered effect)
                const offsetPercentage = (i * 30) - ((maxPreviewImages - 1) * 15);
                previewImg.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
                previewImg.style.zIndex = `${3 - i}`;
                
                // Error handling for missing images
                previewImg.onerror = function() {
                    this.onerror = null;
                    this.src = '';
                    this.style.display = 'flex';
                    this.style.justifyContent = 'center';
                    this.style.alignItems = 'center';
                    this.style.background = '#f5f5f5';
                    this.style.fontSize = '20px';
                    this.innerText = '🧘‍♀️';
                };
                
                imageContainer.appendChild(previewImg);
            }
            
            // Create sequence badge
            const sequenceBadge = document.createElement('span');
            sequenceBadge.className = 'difficulty-badge';
            sequenceBadge.style.backgroundColor = '#ff8c00';
            sequenceBadge.textContent = 'Sequence';
            
            // Create sequence name label
            const sequenceName = document.createElement('p');
            sequenceName.textContent = sequence.name;
            
            // Create pose count label
            const poseCount = document.createElement('p');
            poseCount.textContent = `Sequence • ${sequence.poses.length} poses`;
            poseCount.style.fontSize = '12px';
            poseCount.style.color = '#666';
            poseCount.style.marginTop = '2px';
            
            // Create action buttons container
            const actionButtons = document.createElement('div');
            actionButtons.className = 'sequence-action-buttons';
            actionButtons.style.position = 'absolute';
            actionButtons.style.top = '10px';
            actionButtons.style.right = '10px';
            actionButtons.style.display = 'flex';
            actionButtons.style.gap = '5px';
            actionButtons.style.opacity = '0';
            actionButtons.style.transition = 'opacity 0.2s ease';
            actionButtons.style.zIndex = '10';
            
            // Create delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'table-btn remove-btn';
            deleteButton.style.width = '26px';
            deleteButton.style.height = '26px';
            deleteButton.style.borderRadius = '50%';
            deleteButton.style.backgroundColor = '#ff6b6b';
            deleteButton.style.border = 'none';
            deleteButton.style.color = '#fff';
            deleteButton.style.display = 'flex';
            deleteButton.style.justifyContent = 'center';
            deleteButton.style.alignItems = 'center';
            deleteButton.style.cursor = 'pointer';
            deleteButton.style.fontSize = '16px';
            deleteButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            deleteButton.innerHTML = '×';
            deleteButton.title = 'Delete sequence';
            
            // Add event listener to delete button
            deleteButton.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteSequence(sequence.id);
            });
            
            // Add delete button to container
            actionButtons.appendChild(deleteButton);
            
            // Append elements
            sequenceElement.appendChild(sequenceBadge);
            sequenceElement.appendChild(imageContainer);
            sequenceElement.appendChild(sequenceName);
            sequenceElement.appendChild(poseCount);
            sequenceElement.appendChild(actionButtons);
            
            // Add hover effects
            sequenceElement.addEventListener('mouseenter', function() {
                const images = this.querySelectorAll('img');
                images.forEach((img, idx) => {
                    const offsetPercentage = (idx * 35) - ((maxPreviewImages - 1) * 17.5);
                    img.style.transform = 'scale(1.1)';
                    img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                    img.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
                });
                
                if (actionButtons) {
                    actionButtons.style.opacity = '1';
                }
            });
            
            sequenceElement.addEventListener('mouseleave', function() {
                const images = this.querySelectorAll('img');
                images.forEach((img, idx) => {
                    const offsetPercentage = (idx * 30) - ((maxPreviewImages - 1) * 15);
                    img.style.transform = '';
                    img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    img.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
                });
                
                if (actionButtons) {
                    actionButtons.style.opacity = '0';
                }
            });
            
            // Add click event to load sequence
            sequenceElement.addEventListener('click', function() {
                loadSequence(sequence.id);
            });
            
            // Add to list
            asanaList.appendChild(sequenceElement);
        });
    }
    
    // Show no matches message if both poses and sequences are empty after filtering
    if (asanaList.children.length === 0) {
        asanaList.innerHTML = `
            <div class="no-matches">
                <p>No poses found 🧘‍♂️</p>
                <button class="add-custom-pose-btn" onclick="addCustomPose()">
                    <span>+</span> Add Custom Pose
                </button>
            </div>`;
    }
    
    // Update scroll buttons visibility
    updateScrollButtons();
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

    // Setup for table view only
    setupTableDragAndDrop();

    // Initialize flow sequence with the correct view mode
    initializeViewMode();

    console.log('Drag and drop setup complete');
}

// Initialize view mode based on saved preference
function initializeViewMode() {
    const flowSequence = document.querySelector('.flow-sequence');
    const tableBtn = document.getElementById('tableViewBtn');
    const cardBtn = document.getElementById('cardViewBtn');

    if (flowSequence && tableBtn && cardBtn) {
        if (currentViewMode === 'table') {
            flowSequence.classList.add('table-view-active');
            flowSequence.classList.remove('card-view-active');
            tableBtn.classList.add('active');
            cardBtn.classList.remove('active');
        } else {
            flowSequence.classList.add('card-view-active');
            flowSequence.classList.remove('table-view-active');
            tableBtn.classList.remove('active');
            cardBtn.classList.add('active');
        }
    }
}

function setupTableDragAndDrop() {
    const flowTable = document.getElementById('flowTable');
    if (!flowTable) {
        console.error('Flow table not found for drag and drop setup');
        return;
    }

    // Rebind all drag-and-drop events
    // First remove any existing handlers to prevent duplicates
    flowTable.removeEventListener('dragstart', handleTableDragStart);
    flowTable.removeEventListener('dragenter', handleTableDragEnter);
    flowTable.removeEventListener('dragover', handleTableDragOver);
    flowTable.removeEventListener('dragleave', handleTableDragLeave);
    flowTable.removeEventListener('drop', handleTableDrop);
    flowTable.removeEventListener('dragend', handleTableDragEnd);

    // Now add fresh event listeners
    flowTable.addEventListener('dragstart', handleTableDragStart);
    flowTable.addEventListener('dragenter', handleTableDragEnter);
    flowTable.addEventListener('dragover', handleTableDragOver);
    flowTable.addEventListener('dragleave', handleTableDragLeave);
    flowTable.addEventListener('drop', handleTableDrop);
    flowTable.addEventListener('dragend', handleTableDragEnd);

    // Make sure all rows are properly draggable
    updateRowDragAttributes();
}

function setupCardDragAndDrop() {
    // This function is disabled to prevent loading issues
    console.log('Card drag and drop is disabled');

    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) {
        return;
    }

    // Make sure cards are not draggable
    const cards = cardsContainer.querySelectorAll('.flow-card');
    cards.forEach(card => {
        card.setAttribute('draggable', 'false');

        // Style number indicator without drag functionality
        const numberDiv = card.querySelector('.flow-card-number');
        if (numberDiv) {
            numberDiv.style.cursor = 'default';
            numberDiv.removeAttribute('title');
        }
    });
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
function handleTableDragStart(e) {
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
    
    // Check if the row is a section header
    if (row.classList.contains('section-header')) {
        e.preventDefault();
        return false; // Don't allow dragging section headers
    }
    
    // Store the section ID for later use during drop
    // This will only allow drag and drop within the same section
    const sectionId = row.getAttribute('data-section-id');
    
    console.log('Drag started on row:', row.rowIndex, 'Section ID:', sectionId);
    dragSource = row;
    // Store section ID with the drag source
    dragSource.sectionId = sectionId;
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

function handleTableDragEnter(e) {
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

function handleTableDragOver(e) {
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

function handleTableDragLeave(e) {
    // Only remove the class if we're leaving the row entirely, not just moving between cells
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.target.contains(relatedTarget)) {
        const row = e.target.closest('tr');
        if (row) {
            row.classList.remove('drop-target');
        }
    }
}

function handleTableDrop(e) {
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
    
    // Don't allow dropping on section headers
    if (row.classList.contains('section-header')) {
        console.log('Cannot drop on a section header');
        return;
    }
    
    // Get the section IDs for source and target rows
    const sourceSectionId = dragSource.sectionId;
    const targetSectionId = row.getAttribute('data-section-id');
    
    // Only allow dropping within the same section or if both are unsectioned
    if (sourceSectionId !== targetSectionId) {
        console.log('Cannot move poses between different groups');
        showToastNotification('Poses can only be reordered within the same group');
        return;
    }
    
    console.log('Drop target row:', row.rowIndex);
    
    // Get source and target indices
    const sourceIndex = parseInt(dragSource.getAttribute('data-index'));
    const targetIndex = parseInt(row.getAttribute('data-index'));
    
    if (isNaN(sourceIndex) || isNaN(targetIndex) || sourceIndex === targetIndex) {
        console.log('Invalid indices or source and target are the same');
        return;
    }
    
    console.log('Moving asana from index', sourceIndex, 'to', targetIndex);
    
    try {
        // Update the asanas array
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        editingFlow.asanas.splice(targetIndex, 0, movedAsana);

        // If the poses are in a section, we need to update the section's asanaIds array
        // to reflect the new indices
        if (sourceSectionId) {
            const section = editingFlow.getSectionById(sourceSectionId);
            if (section) {
                // Update all of section.asanaIds to point to the correct indices after the move
                section.asanaIds = section.asanaIds.map(id => {
                    if (id === sourceIndex) return targetIndex;
                    if (sourceIndex < targetIndex) {
                        // Moving down - shift indices in between down by 1
                        if (id > sourceIndex && id <= targetIndex) return id - 1;
                    } else {
                        // Moving up - shift indices in between up by 1
                        if (id >= targetIndex && id < sourceIndex) return id + 1;
                    }
                    return id;
                });
            }
        }

        // Only rebuild the table view - don't rebuild the card view to prevent loss of cards
        rebuildTableView();

        // Just update the positions in the card view without rebuilding it
        updateCardIndices();
        
        // Update recommended poses based on the new last pose
        updateRecommendedPoses();
        
        // Ensure draggable attributes are set again
        setTimeout(updateRowDragAttributes, 0);
        
        // Add highlight animation to the moved row
        setTimeout(() => {
            // Find the row with the target index
            const targetRow = document.querySelector(`tr[data-index="${targetIndex}"]`);
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

function handleTableDragEnd(e) {
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

// Card view drag and drop event handlers
function handleCardDragStart(e) {
    e.stopPropagation(); // Prevent event bubbling

    // Find the card being dragged
    let card = null;

    if (e.target.classList && e.target.classList.contains('flow-card')) {
        card = e.target;
    } else if (e.target.classList && e.target.classList.contains('flow-card-number')) {
        // Allow drag from the number circle
        card = e.target.closest('.flow-card');
    } else {
        // Don't allow drag from other elements
        e.preventDefault();
        return false;
    }

    if (!card) {
        e.preventDefault();
        return false;
    }

    console.log('Drag started on card:', card.getAttribute('data-index'));
    dragSource = card;
    card.classList.add('dragging');

    // Set the drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-index'));

    // Make a ghost image that's more visible
    const dragImage = card.cloneNode(true);
    dragImage.style.width = card.offsetWidth + 'px';
    dragImage.style.height = card.offsetHeight + 'px';
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.backgroundColor = '#fff8f0';
    dragImage.style.border = '2px solid #ff8c00';
    document.body.appendChild(dragImage);

    // Use the custom drag image
    e.dataTransfer.setDragImage(dragImage, 40, 40);

    // Clean up the ghost after a short delay
    setTimeout(() => {
        document.body.removeChild(dragImage);
    }, 100);

    // Reset indicator info
    currentIndicatorInfo = null;
}

// Track the last position to prevent unnecessary updates
let dragOverRafId = null; // For requestAnimationFrame in dragOver
let currentIndicatorInfo = null; // { parent: HTMLElement, nextSibling: HTMLElement | null }

function handleCardDragOver(e) {
    if (!dragSource) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) return;

    if (dragOverRafId) {
        cancelAnimationFrame(dragOverRafId);
    }

    dragOverRafId = requestAnimationFrame(() => {
        const draggingCard = dragSource;
        let newIndicatorParent = cardsContainer;
        let newIndicatorNextSibling = null;

        // Get all non-dragging cards
        const otherCards = Array.from(cardsContainer.querySelectorAll('.flow-card:not(.dragging)'));

        let foundTarget = false;
        for (const card of otherCards) {
            const rect = card.getBoundingClientRect();
            // Check if cursor is within the vertical bounds of this card
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                 // Cursor is over this card. Decide if it's in the top or bottom half.
                if (e.clientY < rect.top + rect.height / 2) {
                    // Top half: insert before this card
                    newIndicatorNextSibling = card;
                } else {
                    // Bottom half: insert after this card
                    newIndicatorNextSibling = card.nextElementSibling;
                }
                foundTarget = true;
                break;
            }
        }

        if (!foundTarget && otherCards.length > 0) {
            // If not directly over any card, determine if cursor is above the first or below the last
            const firstCardRect = otherCards[0].getBoundingClientRect();
            const lastCardRect = otherCards[otherCards.length - 1].getBoundingClientRect();

            if (e.clientY < firstCardRect.top + firstCardRect.height / 2) {
                newIndicatorNextSibling = otherCards[0]; // Place before the first card
            } else if (e.clientY > lastCardRect.top + lastCardRect.height / 2) {
                newIndicatorNextSibling = null; // Place after the last card (at the end)
            } else {
                // Fallback: try to find the closest card to snap to
                let closestCard = null;
                let minDistance = Infinity;
                otherCards.forEach(card => {
                    const rect = card.getBoundingClientRect();
                    const cardCenterY = rect.top + rect.height / 2;
                    const distance = Math.abs(e.clientY - cardCenterY);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCard = card;
                    }
                });
                if (closestCard) {
                    const rect = closestCard.getBoundingClientRect();
                     if (e.clientY < rect.top + rect.height / 2) {
                        newIndicatorNextSibling = closestCard;
                    } else {
                        newIndicatorNextSibling = closestCard.nextElementSibling;
                    }
                }
            }
        } else if (!foundTarget && otherCards.length === 0 && cardsContainer.children.length > 0 && cardsContainer.children[0] !== draggingCard) {
            // Only one card left (the one being dragged is not in otherCards)
            // or container is empty except for the placeholder of the dragging card
             newIndicatorNextSibling = cardsContainer.firstChild; // Default to beginning if container not truly empty
        }


        // Update DOM for indicator only if its logical position changes
        if (!currentIndicatorInfo || currentIndicatorInfo.parent !== newIndicatorParent || currentIndicatorInfo.nextSibling !== newIndicatorNextSibling) {
            const existingIndicator = cardsContainer.querySelector('.drop-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            if (dragSource) {
                const indicator = document.createElement('div');
                indicator.className = 'drop-indicator';
                newIndicatorParent.insertBefore(indicator, newIndicatorNextSibling);
                currentIndicatorInfo = { parent: newIndicatorParent, nextSibling: newIndicatorNextSibling };
            }
        }
    });
}

function handleCardDrop(e) {
    e.preventDefault();

    // Check if we have a valid drag source
    if (!dragSource) {
        console.log('No valid drag source');
        return;
    }

    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) return;

    // Find the card being dropped onto
    let targetCard = null;
    if (e.target.classList && e.target.classList.contains('flow-card')) {
        targetCard = e.target;
    } else {
        targetCard = e.target.closest('.flow-card');
    }

    if (!targetCard) {
        // If not dropped on a card, check if dropped on a drop indicator
        const indicator = e.target.closest('.drop-indicator');
        if (!indicator) return;

        // Get the next card after the indicator
        targetCard = indicator.nextElementSibling;
        if (!targetCard || !targetCard.classList.contains('flow-card')) {
            // If no next card, drop at the end
            const cards = cardsContainer.querySelectorAll('.flow-card');
            targetCard = cards[cards.length - 1];
        }
    }

    if (!targetCard || targetCard === dragSource) return;

    // Get source and target indices
    const sourceIndex = parseInt(dragSource.getAttribute('data-index'));
    const targetIndex = parseInt(targetCard.getAttribute('data-index'));

    if (isNaN(sourceIndex) || isNaN(targetIndex) || sourceIndex === targetIndex) {
        return;
    }

    console.log('Moving asana from', sourceIndex, 'to', targetIndex);

    try {
        // Store the original positions of all cards before making any changes
        const allCards = Array.from(cardsContainer.querySelectorAll('.flow-card'));
        const cardPositions = allCards.map(card => {
            const rect = card.getBoundingClientRect();
            return {
                card: card,
                index: parseInt(card.getAttribute('data-index')),
                left: rect.left,
                top: rect.top
            };
        });

        // Update the asanas array
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        editingFlow.asanas.splice(targetIndex, 0, movedAsana);

        // Temporarily disable transition to avoid animation glitches
        allCards.forEach(card => {
            card.style.transition = 'none';
            card.style.pointerEvents = 'none'; // Prevent interactions during animation
        });

        // Force a reflow
        cardsContainer.offsetHeight;

        // Rebuild both views (this will change the DOM)
        rebuildFlowTable();

        // Get the new card positions
        const newCards = Array.from(cardsContainer.querySelectorAll('.flow-card'));

        // Apply initial transforms to position cards at their original locations
        newCards.forEach(newCard => {
            const newIndex = parseInt(newCard.getAttribute('data-index'));
            const oldPosition = cardPositions.find(pos => {
                // Find the card that was at this position before
                // If this is the moved card, find its original position
                if (newIndex === targetIndex && pos.index === sourceIndex) {
                    return true;
                }
                // For other cards, find their original positions based on index shift
                else if (sourceIndex < targetIndex) {
                    // When moving down, cards in between move up
                    if (pos.index > sourceIndex && pos.index <= targetIndex) {
                        return pos.index - 1 === newIndex;
                    } else {
                        return pos.index === newIndex;
                    }
                } else {
                    // When moving up, cards in between move down
                    if (pos.index >= targetIndex && pos.index < sourceIndex) {
                        return pos.index + 1 === newIndex;
                    } else {
                        return pos.index === newIndex;
                    }
                }
            });

            if (oldPosition) {
                const newRect = newCard.getBoundingClientRect();
                const xDiff = oldPosition.left - newRect.left;
                const yDiff = oldPosition.top - newRect.top;

                // Apply transform to start from the old position
                newCard.style.transform = `translate(${xDiff}px, ${yDiff}px)`;
            }
        });

        // Force a reflow
        cardsContainer.offsetHeight;

        // Enable transitions and animate to new positions
        requestAnimationFrame(() => { // First RAF
            requestAnimationFrame(() => { // Second RAF for timing the "Play" step
                newCards.forEach(newCard => {
                    newCard.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    newCard.style.transform = '';
                });
            });
        });

        // Reset styles and highlight moved card after animation
        setTimeout(() => {
            newCards.forEach(card => {
                card.style.pointerEvents = ''; // Re-enable interactions
            });

            // Find the moved card and apply highlight animation
            const movedCard = newCards.find(card => parseInt(card.getAttribute('data-index')) === targetIndex);
            if (movedCard) {
                movedCard.style.transition = 'all 0.3s ease';
                movedCard.style.boxShadow = '0 0 15px rgba(255, 140, 0, 0.8)';
                movedCard.style.borderColor = '#ff8c00';
                movedCard.style.transform = 'scale(1.03)';

                // Reset after highlight animation completes
                setTimeout(() => {
                    movedCard.style.boxShadow = '';
                    movedCard.style.borderColor = '';
                    movedCard.style.transform = '';
                }, 800);
            }
        }, 550); // Just after the position transition completes

        // Update recommended poses based on the new last pose
        updateRecommendedPoses();

        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    } catch (error) {
        console.error('Error during card drag and drop:', error);
    }
}

function handleCardDragEnd(e) {
    // Clean up the drag operation
    if (dragSource) {
        dragSource.classList.remove('dragging');
    }

    // Remove all drop indicators
    const cardsContainer = document.querySelector('.flow-cards');
    if (cardsContainer) {
        const indicators = cardsContainer.querySelectorAll('.drop-indicator');
        indicators.forEach(indicator => indicator.remove());
    }

    // Clear any pending animation frame for dragOver
    if (dragOverRafId) {
        cancelAnimationFrame(dragOverRafId);
        dragOverRafId = null;
    }

    // Reset all tracking variables
    dragSource = null;
    currentIndicatorInfo = null;
}

// Function to toggle between table and card view
function toggleViewMode(mode) {
    currentViewMode = mode;

    // Save preference to localStorage
    localStorage.setItem('viewMode', mode);

    // Update the toggle buttons
    const tableBtn = document.getElementById('tableViewBtn');
    const cardBtn = document.getElementById('cardViewBtn');
    const flowSequence = document.querySelector('.flow-sequence');
    const viewToggleSwitch = document.getElementById('view-toggle-build');

    if (tableBtn && cardBtn && flowSequence) {
        if (mode === 'table') {
            tableBtn.classList.add('active');
            cardBtn.classList.remove('active');
            flowSequence.classList.add('table-view-active');
            flowSequence.classList.remove('card-view-active');
            // Update the toggle switch to match (unchecked = table)
            if (viewToggleSwitch) viewToggleSwitch.checked = false;
        } else {
            tableBtn.classList.remove('active');
            cardBtn.classList.add('active');
            flowSequence.classList.remove('table-view-active');
            flowSequence.classList.add('card-view-active');
            // Update the toggle switch to match (checked = card)
            if (viewToggleSwitch) viewToggleSwitch.checked = true;
        }
    }

    // Rebuild the flow display to update both views
    rebuildFlowTable();

    // Show a brief notification about the view change
    showToastNotification(`Switched to ${mode} view`);
}

// Function to handle view toggle from the switch
function toggleViewFromSwitch(isChecked) {
    toggleViewMode(isChecked ? 'card' : 'table');
}

function rebuildFlowTable() {
    // First, update table view
    rebuildTableView();

    // Then, update card view
    rebuildCardView();

    // Set the active view based on current mode
    const flowSequence = document.querySelector('.flow-sequence');
    if (flowSequence) {
        if (currentViewMode === 'table') {
            flowSequence.classList.add('table-view-active');
            flowSequence.classList.remove('card-view-active');
        } else {
            flowSequence.classList.remove('table-view-active');
            flowSequence.classList.add('card-view-active');
        }
    }

    // Make sure drag and drop works after rebuild by updating all attributes
    updateDragDropHandlers();

    // Update flow duration
    updateFlowDuration();
}

function rebuildTableView() {
    const table = document.getElementById('flowTable');
    if (!table) return;

    // Clear the table except for the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    // First identify all poses that are in sections and which ones are unsectioned
    let unsectionedAsanas = new Set();
    for (let i = 0; i < editingFlow.asanas.length; i++) {
        unsectionedAsanas.add(i);
    }
    
    // Track section info by the lowest index pose they contain
    // This allows us to place sections in proper order
    const sectionPositions = [];
    
    // Remove asanas that are already in a section and calculate section positions
    editingFlow.sections.forEach((section, sectionIndex) => {
        // Get asanas in this section
        const asanasInSection = editingFlow.getAsanasInSection(section.id)
            .sort((a, b) => a.index - b.index);
            
        if (asanasInSection.length === 0) return;
        
        // Find lowest index in the section to determine its position
        const lowestIndex = Math.min(...asanasInSection.map(a => a.index));
        
        // Store section with its position info
        sectionPositions.push({
            section,
            lowestIndex,
            sectionIndex
        });
        
        // Remove these asanas from unsectioned list
        asanasInSection.forEach(({index}) => {
            unsectionedAsanas.delete(index);
        });
    });
    
    // Sort sectionPositions by lowestIndex to place sections in the correct order
    // This ensures sections appear in order relative to their positions in the flow
    if (tableInDescendingOrder) {
        sectionPositions.sort((a, b) => b.lowestIndex - a.lowestIndex);
    } else {
        sectionPositions.sort((a, b) => a.lowestIndex - b.lowestIndex);
    }
    
    // Create an array to track all asana indices in order
    let allAsanaIndices = [...Array(editingFlow.asanas.length).keys()];
    
    // Respect the current sort order
    if (tableInDescendingOrder) {
        allAsanaIndices.reverse();
    }
    
    // Process each index in order, adding either individual asanas or entire sections
    let processedSections = new Set();
    
    allAsanaIndices.forEach(index => {
        // If this is an unsectioned asana, add it
        if (unsectionedAsanas.has(index)) {
            const asana = editingFlow.asanas[index];
            if (!asana) return;
            
            addAsanaRow(table, asana, index, '', '');
        } 
        // If this is the first asana in a section we haven't processed yet, add the entire section
        else {
            // Find which section contains this asana
            const sectionPosition = sectionPositions.find(sp => 
                sp.lowestIndex === index && !processedSections.has(sp.section.id)
            );
            
            if (sectionPosition) {
                const {section, sectionIndex} = sectionPosition;
                processedSections.add(section.id);
                
                // Add section header row
                const headerRow = table.insertRow(-1);
                headerRow.className = 'section-header';
                headerRow.setAttribute('data-section', section.name);
                headerRow.setAttribute('data-section-id', section.id);
                
                // Add a section color class for consistent coloring
                const colorClass = `section-color-${sectionIndex % 3}`;
                headerRow.classList.add(colorClass);
                
                // Get asanas in this section and sort them by their indices
                const asanasInSection = editingFlow.getAsanasInSection(section.id)
                    .sort((a, b) => a.index - b.index);
                
                // Calculate if all poses in this section are selected
                const allSelected = asanasInSection.every(asanaInfo => asanaInfo.asana.selected);
                
                // Create section header with checkbox
                headerRow.innerHTML = `
                    <td colspan="6" class="section-header-content">
                        <div class="section-header-flex">
                            <div class="section-checkbox">
                                <input type="checkbox" class="section-select" 
                                   data-section="${section.name}" 
                                   data-section-id="${section.id}" 
                                   ${allSelected ? 'checked' : ''}
                                   onchange="toggleSectionSelection(this)">
                            </div>
                            <div class="section-name">
                                <span>${section.name}</span>
                                <span class="section-count">${asanasInSection.length} pose${asanasInSection.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="section-remove">
                                <button class="table-btn remove-btn" onclick="deleteSection('${section.id}')" title="Delete group">×</button>
                            </div>
                        </div>
                    </td>
                `;
                
                // Add asana rows for this section
                asanasInSection.forEach(({asana, index}) => {
                    const row = addAsanaRow(table, asana, index, section.name, section.id);
                    // Add the same color class to ensure visual consistency
                    row.classList.add(colorClass);
                });
            }
        }
    });
    
    // We're removing the "Create New Section" button at the bottom as requested
}

// Helper function to add an asana row to the table
function addAsanaRow(table, asana, index, sectionName, sectionId) {
    if (!asana) return;
    
    const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
    
    const row = table.insertRow(-1);
    // Make the row element draggable for the drag event system to work
    row.setAttribute('draggable', 'true');
    row.setAttribute('data-index', index);
    // Only set section attributes if we have a section
    if (sectionName && sectionId) {
        row.setAttribute('data-section', sectionName);
        row.setAttribute('data-section-id', sectionId);
    }
    
    // Always use the original index+1 for display, regardless of grouping
    // This ensures consistent numbering throughout the flow
    let rowNumber;
    if (tableInDescendingOrder) {
        rowNumber = editingFlow.asanas.length - index;
    } else {
        rowNumber = index + 1;
    }
    
    row.innerHTML = `
        <td title="Drag to reorder">${rowNumber}</td>
        <td>
            <input type="checkbox" class="asana-select" data-index="${index}"
                   ${sectionName ? `data-section="${sectionName}"` : ''}
                   ${sectionId ? `data-section-id="${sectionId}"` : ''}
                   ${asana.selected ? 'checked' : ''}
                   onchange="toggleAsanaSelection(this)">
        </td>
        <td>
            <div class="table-asana">
                <div style="position: relative; display: inline-block;">
                    <img src="${asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}"
                         onerror="this.onerror=null; this.src='images/webp/default-pose.webp'; this.style.display='flex'; this.style.justifyContent='center';
                         this.style.alignItems='center'; this.style.background='#f5f5f5'; this.style.fontSize='24px';
                         this.style.width='50px'; this.style.height='50px'; this.innerText='🧘‍♀️';">
                    ${asana.chakra ? `<div class="chakra-indicator ${
                        asana.chakra.toLowerCase().includes('root') ? 'chakra-root' :
                        asana.chakra.toLowerCase().includes('sacral') ? 'chakra-sacral' :
                        asana.chakra.toLowerCase().includes('solar') ? 'chakra-solar' :
                        asana.chakra.toLowerCase().includes('heart') ? 'chakra-heart' :
                        asana.chakra.toLowerCase().includes('throat') ? 'chakra-throat' :
                        asana.chakra.toLowerCase().includes('third') ? 'chakra-third-eye' :
                        asana.chakra.toLowerCase().includes('crown') ? 'chakra-crown' : ''
                    }" title="${asana.chakra} Chakra"></div>` : ''}
                </div>
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
        <td>
            <button class="table-btn remove-btn" onclick="removePose(this)">×</button>
        </td>
    `;
    
    // Add specific drag handle tooltip and style
    const numCell = row.cells[0];
    numCell.style.cursor = "grab";
    
    return row;
}

function rebuildCardView() {
    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) return;

    // Clear existing cards
    cardsContainer.innerHTML = '';

    // No poses message
    if (editingFlow.asanas.length === 0) {
        cardsContainer.innerHTML = '<div class="empty-message"><p>No poses added yet.</p><p>Select poses from above to build your flow.</p></div>';
        return;
    }

    // Rebuild cards from editingFlow.asanas
    editingFlow.asanas.forEach((asana, index) => {
        if (!asana) return;

        // Determine card number based on current sort order
        let cardNumber;
        if (tableInDescendingOrder) {
            cardNumber = editingFlow.asanas.length - index;
        } else {
            cardNumber = index + 1;
        }

        // Create the card element
        const card = document.createElement('div');
        card.className = 'flow-card';
        card.setAttribute('draggable', 'false'); // Disable dragging
        card.setAttribute('data-index', index);

        // Add chakra data to the card for debugging
        if (asana.chakra) {
            card.setAttribute('data-chakra', asana.chakra);
            console.log(`Card ${index} has chakra: ${asana.chakra}`);
        }

        // Add click handler to the entire card
        card.addEventListener('click', function(e) {
            // We need to ignore clicks on specific interactive elements
            const ignoreElements = ['select', 'input', 'button', '.flow-card-number', '.remove-btn'];
            let shouldIgnore = false;

            for (const selector of ignoreElements) {
                if (e.target.matches && e.target.matches(selector) ||
                    e.target.closest && e.target.closest(selector)) {
                    shouldIgnore = true;
                    break;
                }
            }

            if (!shouldIgnore) {
                e.stopPropagation(); // Stop event from bubbling

                // Find the checkbox
                const checkbox = this.querySelector('.flow-card-checkbox');
                if (checkbox) {
                    // Toggle the checkbox value
                    checkbox.checked = !checkbox.checked;

                    // Trigger the change event manually to update internal state
                    const changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            }
        });

        if (asana.selected) {
            card.classList.add('selected');
        }

        // Create number indicator
        const numberDiv = document.createElement('div');
        numberDiv.className = 'flow-card-number';
        numberDiv.textContent = cardNumber;
        numberDiv.style.cursor = 'grab';
        numberDiv.title = 'Drag to reorder';

        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'flow-card-checkbox asana-select';
        checkbox.checked = asana.selected || false;
        checkbox.setAttribute('data-index', index);
        checkbox.onchange = function() {
            // Update internal state via the existing function
            toggleAsanaSelection(this);

            // Update card visual state
            const card = this.closest('.flow-card');
            if (card) {
                if (this.checked) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        };

        // Create image container (for positioning the chakra indicator)
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        imgContainer.style.display = 'inline-block';

        // Create image
        const img = document.createElement('img');
        img.className = 'flow-card-image';
        img.src = asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`;
        img.alt = asana.name;

        // Allow click events to bubble up to the card
        if (asana.side === "Left") {
            img.style.transform = 'scaleX(-1)';
        }

        // Add error handling for the image
        img.onerror = function() {
            this.onerror = null;
            this.src = 'images/webp/default-pose.webp';
            this.style.display = 'flex';
            this.style.justifyContent = 'center';
            this.style.alignItems = 'center';
            this.style.background = '#f5f5f5';
            this.style.fontSize = '24px';
            this.innerText = '🧘‍♀️';
        };

        // Add chakra indicator if the pose has chakra information
        if (asana.chakra) {
            const chakraIndicator = document.createElement('div');
            chakraIndicator.className = 'chakra-indicator';

            // Add the specific chakra class based on the chakra name
            const chakraClass = asana.chakra.toLowerCase().includes('root') ? 'chakra-root' :
                               asana.chakra.toLowerCase().includes('sacral') ? 'chakra-sacral' :
                               asana.chakra.toLowerCase().includes('solar') ? 'chakra-solar' :
                               asana.chakra.toLowerCase().includes('heart') ? 'chakra-heart' :
                               asana.chakra.toLowerCase().includes('throat') ? 'chakra-throat' :
                               asana.chakra.toLowerCase().includes('third') ? 'chakra-third-eye' :
                               asana.chakra.toLowerCase().includes('crown') ? 'chakra-crown' : '';

            if (chakraClass) {
                chakraIndicator.classList.add(chakraClass);
                chakraIndicator.title = `${asana.chakra} Chakra`;
                imgContainer.appendChild(chakraIndicator);
            }
        }

        imgContainer.appendChild(img);

        // Verify that the chakra indicator is added correctly
        if (imgContainer.querySelector('.chakra-indicator')) {
            console.log(`Added chakra indicator for ${asana.name}`);
        } else if (asana.chakra) {
            console.log(`Failed to add chakra indicator for ${asana.name} with chakra ${asana.chakra}`);
        }

        // Create info container
        const infoDiv = document.createElement('div');
        infoDiv.className = 'flow-card-info';

        // Allow click events to bubble up to the card

        // Create pose name
        const nameP = document.createElement('p');
        nameP.className = 'flow-card-name';
        nameP.textContent = typeof asana.getDisplayName === 'function' ?
            asana.getDisplayName(useSanskritNames) :
            (useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name);

        // Allow click events to bubble up to the card

        // Create side info
        const sideP = document.createElement('div');
        sideP.className = 'flow-card-side';

        // Create side label
        const sideLabel = document.createElement('span');
        sideLabel.textContent = 'Side: ';
        sideLabel.style.fontSize = '14px';
        sideLabel.style.color = '#666';
        sideLabel.style.fontWeight = '500';

        // Create side dropdown
        const sideSelect = document.createElement('select');
        sideSelect.className = 'side-select';
        sideSelect.onchange = function() { updateAsanaImageOrientation(this); };
        sideSelect.onclick = function(e) { e.stopPropagation(); }; // Prevent clicks from bubbling

        if (asana.side === "Center") {
            const option = document.createElement('option');
            option.value = "Center";
            option.textContent = "Center";
            option.selected = true;
            sideSelect.appendChild(option);
        } else {
            const rightOption = document.createElement('option');
            rightOption.value = "Right";
            rightOption.textContent = "Right";
            rightOption.selected = asana.side === "Right";
            sideSelect.appendChild(rightOption);

            const leftOption = document.createElement('option');
            leftOption.value = "Left";
            leftOption.textContent = "Left";
            leftOption.selected = asana.side === "Left";
            sideSelect.appendChild(leftOption);
        }

        sideP.appendChild(sideLabel);
        sideP.appendChild(sideSelect);

        // Create duration container
        const durationDiv = document.createElement('div');
        durationDiv.className = 'flow-card-duration';

        // Create duration label
        const durationLabel = document.createElement('span');
        durationLabel.textContent = 'Duration: ';
        durationLabel.style.fontSize = '14px';
        durationLabel.style.color = '#666';
        durationLabel.style.fontWeight = '500';

        // Create duration input
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.value = asana.duration || 3;
        durationInput.min = 1;
        durationInput.max = 300;
        durationInput.onchange = updateFlowDuration;
        durationInput.onclick = function(e) { e.stopPropagation(); }; // Prevent clicks from bubbling
        // Style already set in CSS

        // Create wrapper for input and seconds unit
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'duration-input-wrapper';

        // Create duration unit (change to 's' for seconds)
        const durationSpan = document.createElement('span');
        durationSpan.className = 'duration-unit';
        durationSpan.textContent = 's';

        inputWrapper.appendChild(durationInput);
        inputWrapper.appendChild(durationSpan);

        durationDiv.appendChild(durationLabel);
        durationDiv.appendChild(inputWrapper);

        // Add all elements to info div
        infoDiv.appendChild(nameP);
        infoDiv.appendChild(sideP);
        infoDiv.appendChild(durationDiv);

        // Create remove button (place it directly on the card, not in actions div)
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove pose';
        removeBtn.onclick = function(e) {
            e.stopPropagation(); // Prevent event bubbling
            removePose(this);
        };

        // Create actions container (we keep this for future actions)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flow-card-actions';

        // Add all elements to the card
        card.appendChild(numberDiv);
        card.appendChild(checkbox);
        card.appendChild(imgContainer);
        card.appendChild(infoDiv);
        card.appendChild(actionsDiv);
        card.appendChild(removeBtn); // Add the remove button directly to the card

        // Add the card to the container
        cardsContainer.appendChild(card);

        // Drag functionality disabled
    });
}

function updateCardIndices() {
    // Update card indices and numbers without rebuilding the entire card view
    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) return;

    const cards = cardsContainer.querySelectorAll('.flow-card');

    // Update each card with the correct index and number
    editingFlow.asanas.forEach((asana, index) => {
        // Find the card with this asana (they should be in the same order)
        const card = cards[index];
        if (!card) return;

        // Update the index attribute
        card.setAttribute('data-index', index);

        // Update the card number
        let cardNumber;
        if (tableInDescendingOrder) {
            cardNumber = editingFlow.asanas.length - index;
        } else {
            cardNumber = index + 1;
        }

        // Update the number display
        const numberDiv = card.querySelector('.flow-card-number');
        if (numberDiv) {
            numberDiv.textContent = cardNumber;
        }

        // Update checkbox index
        const checkbox = card.querySelector('.flow-card-checkbox');
        if (checkbox) {
            checkbox.setAttribute('data-index', index);
        }
    });
}

function updateDragDropHandlers() {
    // Update row attributes for table view
    updateRowDragAttributes();

    // Set up drag handlers for both views
    setupDragAndDrop();
}

// Function to toggle asana selection
function toggleAsanaSelection(checkbox) {
    const index = parseInt(checkbox.getAttribute('data-index'));
    if (!isNaN(index) && editingFlow.asanas[index]) {
        editingFlow.asanas[index].selected = checkbox.checked;
        
        // Update section checkbox state if the pose belongs to a section
        const sectionName = checkbox.getAttribute('data-section');
        const sectionId = checkbox.getAttribute('data-section-id');
        if (sectionName && sectionId) {
            updateSectionCheckbox(sectionName, sectionId);
        }
        
        // Update action buttons state
        updateActionButtons();
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
        
        // Update the select all checkbox state
        updateSelectAllCheckbox();
    }
}

// Function to get selected asanas
function getSelectedAsanas() {
    return editingFlow.asanas.filter(asana => asana.selected);
}

// Function to toggle Sanskrit names
function toggleSanskritNames(event) {
    console.log("Toggle Sanskrit Names called");
    const globalToggle = document.getElementById('sanskrit-toggle-global');
    const buildToggle = document.getElementById('sanskrit-toggle-build');
    const flowToggle = document.getElementById('sanskrit-toggle-flow');
    
    // Determine which toggle was changed directly from the event
    let sourceToggle = event ? event.target : null;
    
    if (!sourceToggle) {
        // If no event, try to determine from active element
        sourceToggle = document.activeElement === buildToggle ? buildToggle : 
                      document.activeElement === globalToggle ? globalToggle :
                      document.activeElement === flowToggle ? flowToggle : buildToggle;
    }
    
    // Sync all toggles to match the source toggle
    if (globalToggle && sourceToggle) {
        globalToggle.checked = sourceToggle.checked;
    }
    if (buildToggle && sourceToggle) {
        buildToggle.checked = sourceToggle.checked;
    }
    if (flowToggle && sourceToggle) {
        flowToggle.checked = sourceToggle.checked;
    }
    
    // Update the global state
    useSanskritNames = sourceToggle ? sourceToggle.checked : false;
    console.log("Sanskrit names toggled to:", useSanskritNames);
    
    // Save to localStorage
    localStorage.setItem('useSanskritNames', useSanskritNames);
    
    // Update UI elements that display pose names
    updateAsanaDisplayNames();
    
    // Always update the asana list regardless of current screen
    populateAsanaList();
    
    // Force rebuild of the flow table if we have a flow
    if (editingFlow && editingFlow.asanas && editingFlow.asanas.length > 0) {
        rebuildFlowTable();
    }
    
    // If in flow screen, update the current asana display and next asana
    if (currentScreenId === 'flowScreen' && editingFlow.asanas && editingFlow.asanas.length > 0) {
        // Get current asana
        const currentAsana = editingFlow.asanas[currentAsanaIndex];
        
        // Update current asana name immediately
        const asanaNameElement = document.getElementById("asanaName");
        if (asanaNameElement && currentAsana) {
            asanaNameElement.textContent = currentAsana.getDisplayName(useSanskritNames);
        }
        
        // Update next asana if available
        const nextAsana = editingFlow.asanas[currentAsanaIndex + 1];
        if (nextAsana) {
            const nextAsanaNameElement = document.getElementById('nextAsanaName');
            if (nextAsanaNameElement) {
                // Apply animation by resetting it
                nextAsanaNameElement.style.animation = 'none';
                nextAsanaNameElement.offsetHeight; // Trigger reflow
                nextAsanaNameElement.style.animation = 'fade-in 0.6s ease-out';
                
                nextAsanaNameElement.textContent = nextAsana.getDisplayName(useSanskritNames);
            }
        }
        
        // Update speech if enabled and speaking
        if (speechEnabled && !paused && speechSynthesis.speaking) {
            // Cancel current speech
            speechSynthesis.cancel();
            // Speak the current pose name in the new language
            speakAsanaName(currentAsana.name, currentAsana.side, currentAsana.sanskrit);
        }
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

// Function to toggle sequences section
function toggleSequences() {
    const header = document.querySelector('.sequences-header');
    const content = document.getElementById('sequencesContent');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        header.classList.remove('collapsed');
        header.classList.add('expanded');
    } else {
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        header.classList.remove('expanded');
        header.classList.add('collapsed');
    }
}

// Initialize the app
function initializeApp() {
    // Load asanas from XML
    loadAsanasFromXML().then(() => {
        // Display flows
        displayFlows();

        // Display sequences
        displaySequences();

        // Initialize view toggle buttons with saved preference
        const tableBtn = document.getElementById('tableViewBtn');
        const cardBtn = document.getElementById('cardViewBtn');
        const viewToggleSwitch = document.getElementById('view-toggle-build');

        if (tableBtn && cardBtn) {
            if (currentViewMode === 'table') {
                tableBtn.classList.add('active');
                cardBtn.classList.remove('active');
                if (viewToggleSwitch) viewToggleSwitch.checked = false;
            } else {
                tableBtn.classList.remove('active');
                cardBtn.classList.add('active');
                if (viewToggleSwitch) viewToggleSwitch.checked = true;
            }
        }

        // Set up drag and drop
        setupDragAndDrop();
        
        // Update date
        updateDate();
        
        // Set up event listeners
        const asanaSearch = document.getElementById('asanaSearch');
        if (asanaSearch) {
            asanaSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const asanaItems = document.querySelectorAll('.asana-item');
                
                asanaItems.forEach(item => {
                    const asanaName = item.querySelector('p').textContent.toLowerCase();
                    const matches = asanaName.includes(searchTerm);
                    item.style.display = matches ? 'flex' : 'none';
                });
                
                // Update scroll buttons visibility
                updateScrollButtons();
            });
        }
        
        // Set up Sanskrit name toggle
        const sanskritToggle = document.getElementById('sanskrit-toggle-global');
        if (sanskritToggle) {
            sanskritToggle.addEventListener('change', function() {
                useSanskritNames = this.checked;
                updateAsanaDisplayNames();
            });
        }

        // Set up build screen Sanskrit toggle
        const sanskritToggleBuild = document.getElementById('sanskrit-toggle-build');
        if (sanskritToggleBuild) {
            sanskritToggleBuild.checked = useSanskritNames; // Set initial state
            sanskritToggleBuild.addEventListener('change', toggleSanskritNames);
        }

        // Set up global Sanskrit toggle
        const sanskritToggleGlobal = document.getElementById('sanskrit-toggle-global');
        if (sanskritToggleGlobal) {
            sanskritToggleGlobal.checked = useSanskritNames; // Set initial state
            sanskritToggleGlobal.addEventListener('change', toggleSanskritNames);
        }
        
        // Set up speech toggle
        const speechToggle = document.getElementById('speech-toggle-global');
        if (speechToggle) {
            speechToggle.addEventListener('change', function() {
                speechEnabled = this.checked;
            });
        }
    });
}

// Add event listener to initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Loaded - Initializing app with Sanskrit names:", useSanskritNames);
    initializeApp();
});

// Function to toggle select all checkboxes
function toggleSelectAll(checkbox) {
    const isChecked = checkbox.checked;
    
    // Update all checkboxes in the table
    const table = document.getElementById('flowTable');
    const checkboxes = table.querySelectorAll('.asana-select');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    
    // Update all asanas in the editingFlow
    editingFlow.asanas.forEach(asana => {
        if (asana) {
            asana.selected = isChecked;
        }
    });
    
    // Update action buttons state
    updateActionButtons();
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
    
    // Show a brief notification
    showToastNotification(isChecked ? 'All poses selected' : 'All poses deselected');
}

// Function to handle section selection toggling
function toggleSectionSelection(checkbox) {
    const sectionName = checkbox.getAttribute('data-section');
    const sectionId = checkbox.getAttribute('data-section-id');
    const isChecked = checkbox.checked;
    
    // Find all asana checkboxes in this section
    const table = document.getElementById('flowTable');
    let sectionCheckboxes;
    
    if (sectionId === 'unsectioned') {
        // Use section index for unsectioned poses
        sectionCheckboxes = table.querySelectorAll(`.asana-select[data-section-index="unsectioned"]`);
    } else {
        // Use section ID for user-created sections
        sectionCheckboxes = table.querySelectorAll(`.asana-select[data-section-id="${sectionId}"]`);
    }
    
    // Update all checkboxes in this section
    sectionCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        
        // Update the asana data model
        const asanaIndex = parseInt(cb.getAttribute('data-index'));
        if (!isNaN(asanaIndex) && editingFlow.asanas[asanaIndex]) {
            editingFlow.asanas[asanaIndex].selected = isChecked;
        }
    });
    
    // Update action buttons state
    updateActionButtons();
    
    // Update the select all checkbox state
    updateSelectAllCheckbox();
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
    
    // Show a brief notification
    showToastNotification(isChecked ? `${sectionName} poses selected` : `${sectionName} poses deselected`);
}

// Function to update section checkbox state
function updateSectionCheckbox(sectionName, sectionId) {
    const table = document.getElementById('flowTable');
    let sectionCheckbox, asanaCheckboxes;
    
    if (sectionId === 'unsectioned') {
        // For unsectioned poses
        sectionCheckbox = table.querySelector(`.section-select[data-section-index="unsectioned"]`);
        asanaCheckboxes = table.querySelectorAll(`.asana-select[data-section-index="unsectioned"]`);
    } else {
        // For user-created sections
        sectionCheckbox = table.querySelector(`.section-select[data-section-id="${sectionId}"]`);
        asanaCheckboxes = table.querySelectorAll(`.asana-select[data-section-id="${sectionId}"]`);
    }
    
    if (sectionCheckbox && asanaCheckboxes.length > 0) {
        // Check if all asanas in this section are selected
        const allChecked = Array.from(asanaCheckboxes).every(cb => cb.checked);
        sectionCheckbox.checked = allChecked;
    }
}

// Function to update select all checkbox state based on individual selections
function updateSelectAllCheckbox() {
    const table = document.getElementById('flowTable');
    const checkboxes = table.querySelectorAll('.asana-select');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (checkboxes.length === 0) {
        selectAllCheckbox.checked = false;
        return;
    }
    
    // Check if all checkboxes are checked
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
}

// Function to update action buttons state
// Function to show dialog for adding a new section/group
function showAddSectionDialog() {
    // Create a modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal section-modal';
    modal.style.display = 'block';
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Create New Group</h2>
            <p class="modal-description">Enter a name for your new group:</p>
            <div class="section-name-input-container">
                <input type="text" id="newSectionName" placeholder="Group Name" class="section-name-input">
                <button class="create-section-btn" onclick="createNewSection()">Group</button>
            </div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(modal);
    
    // Focus the input field
    setTimeout(() => {
        const input = document.getElementById('newSectionName');
        if (input) input.focus();
        
        // Add enter key event listener
        input.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                createNewSection();
            }
        });
    }, 100);
}

// Function to create a new section
function createNewSection() {
    const nameInput = document.getElementById('newSectionName');
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        alert('Please enter a section name');
        return;
    }
    
    // Create a new section
    const sectionId = editingFlow.addSection(name);
    
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    showToastNotification(`Group "${name}" created`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to show dialog for adding a pose to a section
function showAddToSectionDialog(asanaIndex) {
    // Only show if there are sections to add to
    if (editingFlow.sections.length === 0) {
        showAddSectionDialog();
        return;
    }
    
    // Create a modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal section-modal';
    modal.style.display = 'block';
    
    // Create section options
    let sectionOptions = '';
    editingFlow.sections.forEach(section => {
        sectionOptions += `<option value="${section.id}">${section.name}</option>`;
    });
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Add to Section</h2>
            <p class="modal-description">Select a section to add this pose to:</p>
            <div class="section-select-container">
                <select id="sectionSelect" class="section-select-dropdown">
                    ${sectionOptions}
                </select>
                <button class="add-to-section-btn" onclick="addPoseToSection(${asanaIndex})">Add</button>
            </div>
            <div class="create-new-section-link">
                <a href="#" onclick="this.closest('.modal').remove(); showAddSectionDialog();">Create New Section</a>
            </div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(modal);
}

// Function to add a pose to a section
function addPoseToSection(asanaIndex) {
    const select = document.getElementById('sectionSelect');
    const sectionId = select ? select.value : null;
    
    if (!sectionId) {
        alert('Please select a section');
        return;
    }
    
    // Check if the pose is already in a section
    let alreadyInSection = false;
    editingFlow.sections.forEach(section => {
        if (section.asanaIds.includes(asanaIndex)) {
            alreadyInSection = true;
        }
    });
    
    if (alreadyInSection) {
        alert('This pose is already in a group. A pose can only be in one group at a time.');
        
        // Close the modal
        const modal = document.querySelector('.section-modal');
        if (modal) modal.remove();
        return;
    }
    
    // Add the pose to the section
    // When adding a single pose, we preserve the position by simply adding the ID
    editingFlow.addAsanaToSection(asanaIndex, sectionId);
    
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    const section = editingFlow.getSectionById(sectionId);
    showToastNotification(`Pose added to "${section.name}"`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to remove a pose from a section
function removeFromSection(asanaIndex, sectionId) {
    // Get the section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
    // Remove the pose from the section
    editingFlow.removeAsanaFromSection(asanaIndex, sectionId);
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    showToastNotification(`Pose removed from "${section.name}"`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to edit a section name
function editSectionName(sectionId) {
    // Get the section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
    // Create a modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal section-modal';
    modal.style.display = 'block';
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Edit Section Name</h2>
            <p class="modal-description">Enter a new name for the section:</p>
            <div class="section-name-input-container">
                <input type="text" id="editSectionName" value="${section.name}" class="section-name-input">
                <button class="save-section-btn" onclick="saveSectionName('${sectionId}')">Save</button>
            </div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(modal);
    
    // Focus the input field
    setTimeout(() => {
        const input = document.getElementById('editSectionName');
        if (input) {
            input.focus();
            input.select();
        }
        
        // Add enter key event listener
        input.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                saveSectionName(sectionId);
            }
        });
    }, 100);
}

// Function to save a section name
function saveSectionName(sectionId) {
    const nameInput = document.getElementById('editSectionName');
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        alert('Please enter a section name');
        return;
    }
    
    // Get the section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
    // Update the section name
    const oldName = section.name;
    section.name = name;
    
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    showToastNotification(`Section renamed from "${oldName}" to "${name}"`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to delete a section
function deleteSection(sectionId) {
    // Get the section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
    // Get the poses in this section
    const asanasInSection = editingFlow.getAsanasInSection(sectionId);
    const poseCount = asanasInSection.length;
    
    // Confirm deletion with pose count information
    if (!confirm(`Are you sure you want to delete the group "${section.name}" with ${poseCount} pose${poseCount !== 1 ? 's' : ''}?\n\nThe poses will remain in your flow but will no longer be grouped.`)) {
        return;
    }
    
    // Remove the section with animation
    const sectionHeader = document.querySelector(`tr.section-header[data-section-id="${sectionId}"]`);
    if (sectionHeader) {
        // Apply a highlight animation to the row before deletion
        sectionHeader.style.transition = 'background-color 0.3s ease';
        sectionHeader.style.backgroundColor = '#ffcccc';
        
        // Get all the section's rows for animation
        const sectionRows = document.querySelectorAll(`tr[data-section-id="${sectionId}"]`);
        sectionRows.forEach(row => {
            row.style.transition = 'background-color 0.3s ease';
            row.style.backgroundColor = '#ffcccc';
        });
        
        // Delay the actual deletion to show the animation
        setTimeout(() => {
            // Remove the section
            const sectionIndex = editingFlow.sections.findIndex(s => s.id === sectionId);
            if (sectionIndex !== -1) {
                editingFlow.sections.splice(sectionIndex, 1);
            }
            
            // Rebuild the table view
            rebuildTableView();
            
            // Show a notification
            showToastNotification(`Group "${section.name}" deleted`);
            
            // Auto-save if in edit mode
            if (editMode) {
                autoSaveFlow();
            }
        }, 300);
    } else {
        // Fallback if no animation is possible
        // Remove the section
        const sectionIndex = editingFlow.sections.findIndex(s => s.id === sectionId);
        if (sectionIndex !== -1) {
            editingFlow.sections.splice(sectionIndex, 1);
        }
        
        // Rebuild the table view
        rebuildTableView();
        
        // Show a notification
        showToastNotification(`Group "${section.name}" deleted`);
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    }
}

// Function to add selected poses to a section/group
function addSelectedToSection() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) return;
    
    // Get indices of selected poses
    const selectedIndices = [];
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            selectedIndices.push(index);
        }
    });
    
    // Create a simplified modal for direct group creation
    const modal = document.createElement('div');
    modal.className = 'modal section-modal';
    modal.style.display = 'block';
    
    // Get the count of selected poses
    const selectedCount = selectedIndices.length;
    
    // Create modal content with just a name input for simplicity
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Group Selected Poses</h2>
            <p class="modal-description">Enter a name for this group of ${selectedCount} pose${selectedCount !== 1 ? 's' : ''}:</p>
            <div class="section-name-input-container">
                <input type="text" id="newGroupName" placeholder="Group Name" class="section-name-input">
                <button class="create-section-btn" onclick="createGroupFromSelection()">Group</button>
            </div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(modal);
    
    // Focus the input field
    setTimeout(() => {
        const input = document.getElementById('newGroupName');
        if (input) {
            input.focus();
            
            // Add enter key event listener
            input.addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    createGroupFromSelection();
                }
            });
        }
    }, 100);
}

// Function to create a new group from selected poses
function createGroupFromSelection() {
    const nameInput = document.getElementById('newGroupName');
    const groupName = nameInput ? nameInput.value.trim() : '';
    
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    // Get indices of selected poses
    const validSelectedIndices = [];
    const alreadyGroupedPoses = [];
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            // Check if this pose is already in a section
            let isInAnotherSection = false;
            editingFlow.sections.forEach(section => {
                if (section.asanaIds.includes(index)) {
                    isInAnotherSection = true;
                    alreadyGroupedPoses.push(index);
                }
            });
            
            if (!isInAnotherSection) {
                validSelectedIndices.push(index);
            }
        }
    });
    
    // Notify if some poses were skipped because they're already in groups
    if (alreadyGroupedPoses.length > 0) {
        alert(`${alreadyGroupedPoses.length} pose${alreadyGroupedPoses.length !== 1 ? 's were' : ' was'} skipped because ${alreadyGroupedPoses.length !== 1 ? 'they are' : 'it is'} already in a group. A pose can only be in one group at a time.`);
    }
    
    if (validSelectedIndices.length === 0) {
        alert('No valid poses selected that can be grouped');
        
        // Close the modal
        const modal = document.querySelector('.section-modal');
        if (modal) modal.remove();
        return;
    }
    
    // Create a new section
    const sectionId = editingFlow.addSection(groupName);
    
    // Sort the indices to preserve the original order of poses in the flow
    const sortedIndices = [...validSelectedIndices].sort((a, b) => a - b);
    
    // Add all valid selected poses to the section in their sorted order
    sortedIndices.forEach(index => {
        editingFlow.addAsanaToSection(index, sectionId);
    });
    
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    showToastNotification(`Created group "${groupName}" with ${validSelectedIndices.length} pose${validSelectedIndices.length !== 1 ? 's' : ''}`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to add multiple poses to a section
function addMultiplePosesToSection() {
    const select = document.getElementById('sectionSelect');
    const sectionId = select ? select.value : null;
    
    if (!sectionId) {
        alert('Please select a section');
        return;
    }
    
    // Get the section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
    // Get indices of selected poses
    const selectedIndices = [];
    const alreadyGroupedPoses = [];
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            // Check if this pose is already in a section
            let isInAnotherSection = false;
            editingFlow.sections.forEach(sect => {
                if (sect.asanaIds.includes(index)) {
                    isInAnotherSection = true;
                    alreadyGroupedPoses.push(index);
                }
            });
            
            if (!isInAnotherSection) {
                selectedIndices.push(index);
            }
        }
    });
    
    // Notify if some poses were skipped because they're already in groups
    if (alreadyGroupedPoses.length > 0) {
        alert(`${alreadyGroupedPoses.length} pose${alreadyGroupedPoses.length !== 1 ? 's were' : ' was'} skipped because ${alreadyGroupedPoses.length !== 1 ? 'they are' : 'it is'} already in a group. A pose can only be in one group at a time.`);
    }
    
    // If no valid poses to add, return
    if (selectedIndices.length === 0) {
        // Close the modal
        const modal = document.querySelector('.section-modal');
        if (modal) modal.remove();
        return;
    }
    
    // Sort indices to preserve the original flow order
    const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
    
    // Add selected poses to the section in their original order
    sortedIndices.forEach(index => {
        editingFlow.addAsanaToSection(index, sectionId);
    });
    
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Rebuild the table view
    rebuildTableView();
    
    // Show a notification
    showToastNotification(`${selectedIndices.length} pose${selectedIndices.length !== 1 ? 's' : ''} added to "${section.name}"`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

function updateActionButtons() {
    const copyBtn = document.getElementById('copySelectedBtn');
    const pasteBtn = document.getElementById('pasteSelectedBtn');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const saveSequenceBtn = document.getElementById('saveSequenceBtn');
    const addToSectionBtn = document.getElementById('addToSectionBtn');
    
    const selectedPoses = getSelectedAsanas();
    const hasSelectedPoses = selectedPoses.length > 0;
    const hasCopiedPoses = copiedPoses.length > 0;
    
    if (copyBtn) copyBtn.disabled = !hasSelectedPoses;
    if (pasteBtn) pasteBtn.disabled = !hasCopiedPoses;
    if (deleteBtn) deleteBtn.disabled = !hasSelectedPoses;
    if (saveSequenceBtn) saveSequenceBtn.disabled = !hasSelectedPoses;
    if (addToSectionBtn) addToSectionBtn.disabled = !hasSelectedPoses;
}

// Function to copy selected poses
function copySelectedPoses() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) return;
    
    // Create deep copies of selected poses
    copiedPoses = selectedPoses.map(asana => {
        const newAsana = new YogaAsana(
            asana.name,
            asana.side,
            asana.image,
            asana.description,
            asana.difficulty,
            [...asana.tags],
            [...asana.transitionsAsana],
            asana.sanskrit,
            asana.chakra || ""
        );
        newAsana.setDuration(asana.duration);
        return newAsana;
    });
    
    // Update button states
    updateActionButtons();
    
    // Show notification
    showToastNotification(`Copied ${copiedPoses.length} pose${copiedPoses.length !== 1 ? 's' : ''}`);
}

// Function to paste copied poses
function pasteSelectedPoses() {
    if (copiedPoses.length === 0) return;
    
    // Create new asanas from copied poses
    const newAsanas = copiedPoses.map(asana => {
        const newAsana = new YogaAsana(
            asana.name,
            asana.side,
            asana.image,
            asana.description,
            asana.difficulty,
            [...asana.tags],
            [...asana.transitionsAsana],
            asana.sanskrit,
            asana.chakra || ""
        );
        newAsana.setDuration(asana.duration);
        return newAsana;
    });
    
    // Add poses based on sort order
    if (tableInDescendingOrder) {
        // If in descending order, add to the beginning of the array
        editingFlow.asanas.unshift(...newAsanas);
    } else {
        // If in ascending order, add to the end of the array
        editingFlow.asanas.push(...newAsanas);
    }
    
    // Rebuild the table
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Pasted ${copiedPoses.length} pose${copiedPoses.length !== 1 ? 's' : ''}`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to delete selected poses
function deleteSelectedPoses() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) return;
    
    // Remove selected poses from the flow
    editingFlow.asanas = editingFlow.asanas.filter(asana => !asana.selected);
    
    // Rebuild the table
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Deleted ${selectedPoses.length} pose${selectedPoses.length !== 1 ? 's' : ''}`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to save a sequence
function saveSequence() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) return;

    // Create a name for the sequence based on the poses
    const defaultName = "My Sequence";
    const sequenceName = prompt('Enter a name for this sequence (max 37 characters):', defaultName);
    
    if (!sequenceName) return; // User cancelled

    // Validate sequence name
    if (sequenceName.trim() === '') {
        showToastNotification('Sequence name cannot be empty');
        return;
    }

    if (sequenceName.length > 37) {
        showToastNotification('Sequence name cannot exceed 37 characters');
        return;
    }

    // Create a new sequence object
    const sequence = {
        id: generateUniqueID(),
        name: sequenceName.trim(),
        poses: selectedPoses.map(asana => {
            const newAsana = new YogaAsana(
                asana.name,
                asana.side,
                asana.image,
                asana.description,
                asana.difficulty,
                [...asana.tags],
                [...asana.transitionsAsana],
                asana.sanskrit,
                asana.chakra || ""
            );
            newAsana.setDuration(asana.duration);
            return newAsana;
        }),
        createdAt: new Date().toISOString()
    };

    // Get existing sequences
    let sequences = JSON.parse(localStorage.getItem('sequences') || '[]');
    
    // Add new sequence
    sequences.push(sequence);
    
    // Save back to localStorage
    localStorage.setItem('sequences', JSON.stringify(sequences));
    
    // Show success notification
    showToastNotification(`Sequence "${sequenceName}" saved successfully`);
    
    // Update the sequences display
    displaySequences();
    
    // Add the new sequence directly to the asana list
    const asanaList = document.getElementById('asanaList');
    if (asanaList) {
        // Create sequence element styled like asana-item
        const sequenceElement = document.createElement('div');
        sequenceElement.className = 'asana-item';
        sequenceElement.draggable = true;
        sequenceElement.setAttribute('data-sequence-id', sequence.id);
        
        // Create a container for sequence preview images
        const imageContainer = document.createElement('div');
        imageContainer.className = 'sequence-preview-container';
        imageContainer.style.display = 'flex';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.position = 'relative';
        imageContainer.style.height = '85px';
        imageContainer.style.width = '100%';
        
        // Add up to 3 preview images from the sequence
        const maxPreviewImages = Math.min(3, sequence.poses.length);
        for (let i = 0; i < maxPreviewImages; i++) {
            const pose = sequence.poses[i];
            const previewImg = document.createElement('img');
            previewImg.src = pose.image;
            previewImg.alt = pose.name;
            previewImg.style.width = '60px';
            previewImg.style.height = '60px';
            previewImg.style.objectFit = 'contain';
            previewImg.style.position = 'absolute';
            previewImg.style.borderRadius = '50%';
            previewImg.style.background = 'white';
            previewImg.style.padding = '2px';
            previewImg.style.border = '1px solid #eee';
            previewImg.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            previewImg.style.transition = 'all 0.3s ease';
            
            // Position each image (staggered effect) - center the images with offsets
            const offsetPercentage = (i * 30) - ((maxPreviewImages - 1) * 15);
            previewImg.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
            previewImg.style.zIndex = `${3 - i}`;
            
            // Error handling for missing images
            previewImg.onerror = function() {
                this.onerror = null;
                this.src = '';
                this.style.display = 'flex';
                this.style.justifyContent = 'center';
                this.style.alignItems = 'center';
                this.style.background = '#f5f5f5';
                this.style.fontSize = '20px';
                this.innerText = '🧘‍♀️';
            };
            
            imageContainer.appendChild(previewImg);
        }
        
        // Create sequence badge
        const sequenceBadge = document.createElement('span');
        sequenceBadge.className = 'difficulty-badge';
        sequenceBadge.style.backgroundColor = '#ff8c00';
        sequenceBadge.textContent = 'Sequence';
        
        // Create sequence name label
        const sequenceName = document.createElement('p');
        sequenceName.textContent = sequence.name;
        
        // Create pose count label with sequence indicator
        const poseCount = document.createElement('p');
        poseCount.textContent = `Sequence • ${sequence.poses.length} poses`;
        poseCount.style.fontSize = '12px';
        poseCount.style.color = '#666';
        poseCount.style.marginTop = '2px';
        
        // Create action buttons container
        const actionButtons = document.createElement('div');
        actionButtons.className = 'sequence-action-buttons';
        actionButtons.style.position = 'absolute';
        actionButtons.style.top = '10px';
        actionButtons.style.right = '10px';
        actionButtons.style.display = 'flex';
        actionButtons.style.gap = '5px';
        actionButtons.style.opacity = '0';
        actionButtons.style.transition = 'opacity 0.2s ease';
        actionButtons.style.zIndex = '10';
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'table-btn remove-btn';
        deleteButton.style.width = '26px';
        deleteButton.style.height = '26px';
        deleteButton.style.borderRadius = '50%';
        deleteButton.style.backgroundColor = '#ff6b6b';
        deleteButton.style.border = 'none';
        deleteButton.style.color = '#fff';
        deleteButton.style.display = 'flex';
        deleteButton.style.justifyContent = 'center';
        deleteButton.style.alignItems = 'center';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.fontSize = '16px';
        deleteButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        deleteButton.innerHTML = '×';
        deleteButton.title = 'Delete sequence';
        
        // Add event listener to delete button (with stopPropagation to prevent triggering the parent click)
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteSequence(sequence.id);
        });
        
        // Add delete button to container
        actionButtons.appendChild(deleteButton);
        
        // Append elements
        sequenceElement.appendChild(sequenceBadge);
        sequenceElement.appendChild(imageContainer);
        sequenceElement.appendChild(sequenceName);
        sequenceElement.appendChild(poseCount);
        sequenceElement.appendChild(actionButtons);
        
        // Add event listener for click to load the sequence
        sequenceElement.addEventListener('click', function() {
            loadSequence(sequence.id);
        });
        
        // Add hover effects
        sequenceElement.addEventListener('mouseenter', function() {
            // Fan out the images slightly on hover
            const images = this.querySelectorAll('img');
            images.forEach((img, idx) => {
                const offsetPercentage = (idx * 35) - ((maxPreviewImages - 1) * 17.5);
                img.style.transform = 'scale(1.1)';
                img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                img.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
            });
            
            // Show delete button on hover
            if (actionButtons) {
                actionButtons.style.opacity = '1';
            }
        });
        
        sequenceElement.addEventListener('mouseleave', function() {
            // Reset the images on mouse leave
            const images = this.querySelectorAll('img');
            images.forEach((img, idx) => {
                const offsetPercentage = (idx * 30) - ((maxPreviewImages - 1) * 15);
                img.style.transform = '';
                img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                img.style.left = `calc(50% - 30px + ${offsetPercentage}%)`;
            });
            
            // Hide delete button when not hovering
            if (actionButtons) {
                actionButtons.style.opacity = '0';
            }
        });
        
        // Add to list with animation
        sequenceElement.style.opacity = '0';
        sequenceElement.style.transform = 'translateY(20px)';
        asanaList.appendChild(sequenceElement);
        
        // Trigger animation
        setTimeout(() => {
            sequenceElement.style.transition = 'all 0.2s ease';
            sequenceElement.style.opacity = '1';
            sequenceElement.style.transform = 'translateY(0)';
            
            // Change filter to "All Poses"
            filterAsanas('all');
            
            // Scroll to the new sequence
            const scrollPosition = sequenceElement.offsetLeft - (asanaList.offsetWidth - sequenceElement.offsetWidth) / 2;
            asanaList.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        }, 10);
    }
}

// Function to load sequences
function getSequences() {
    try {
        const sequencesJson = localStorage.getItem('sequences');
        if (!sequencesJson) return [];
        return JSON.parse(sequencesJson);
    } catch (error) {
        console.error('Error getting sequences:', error);
        return [];
    }
}

// Function to delete a sequence
function deleteSequence(sequenceId) {
    if (!confirm('Are you sure you want to delete this sequence?')) return;
    
    let sequences = getSequences();
    sequences = sequences.filter(seq => seq.id !== sequenceId);
    localStorage.setItem('sequences', JSON.stringify(sequences));
    
    showToastNotification('Sequence deleted successfully');
    
    // Update the sequences display
    displaySequences();
    
    // Find and remove the sequence element from asanaList
    const asanaList = document.getElementById('asanaList');
    if (asanaList) {
        const sequenceElement = asanaList.querySelector(`[data-sequence-id="${sequenceId}"]`);
        if (sequenceElement) {
            // Add fade out animation
            sequenceElement.style.transition = 'all 0.2s ease';
            sequenceElement.style.opacity = '0';
            sequenceElement.style.transform = 'translateY(20px)';
            
            // Remove the element after animation
            setTimeout(() => {
                sequenceElement.remove();
            }, 200);
        }
    }
}

// Function to edit a sequence
function editSequence(sequenceId) {
    // Get current sequences
    const sequences = getSequences();
    
    // Find the sequence with matching ID
    const sequence = sequences.find(seq => seq.id === sequenceId);
    
    if (!sequence) {
        showToastNotification('Sequence not found');
        return;
    }
    
    // Load the sequence poses into the editor
    editingFlow = new Flow();
    
    // Add the sequence poses to the flow
    sequence.poses.forEach(asana => {
        const newAsana = new YogaAsana(
            asana.name,
            asana.side,
            asana.image,
            asana.description,
            asana.difficulty,
            [...asana.tags],
            [...asana.transitionsAsana],
            asana.sanskrit,
            asana.chakra || ""
        );
        newAsana.setDuration(asana.duration);
        editingFlow.addAsana(newAsana);
    });
    
    // Set a title for the flow using the sequence name
    editingFlow.name = `Edit: ${sequence.name}`;
    
    // Store the sequence ID to update it later
    editingFlow.editingSequenceId = sequenceId;
    
    // Update flow duration
    editingFlow.calculateTotalDuration();
    
    // Show toast notification
    showToastNotification(`Editing sequence: ${sequence.name}`);
    
    // Switch to the build screen
    changeScreen('buildScreen');
    
    // Update the UI
    const titleInput = document.getElementById('title');
    if (titleInput) {
        titleInput.value = sequence.name;
    }
    
    // Rebuild the table to show the sequence poses
    rebuildFlowTable();
    
    // Add a save button event listener to save the edited sequence
    const saveBtn = document.querySelector('.save-flow-btn');
    if (saveBtn) {
        // Store original onclick
        const originalOnClick = saveBtn.onclick;
        
        // Replace with our function
        saveBtn.onclick = function() {
            // Update the sequence
            updateEditedSequence(sequenceId, sequence.name);
            
            // Restore original handler
            saveBtn.onclick = originalOnClick;
            
            // Go back to home screen
            changeScreen('homeScreen');
        };
        
        // Update button text
        saveBtn.textContent = 'Done';
    }
}

// Function to update an edited sequence
function updateEditedSequence(sequenceId, originalName) {
    // Get current sequences
    const sequences = getSequences();
    
    // Find the sequence with matching ID
    const index = sequences.findIndex(seq => seq.id === sequenceId);
    
    if (index === -1) {
        showToastNotification('Sequence not found');
        return;
    }
    
    // Get the title input
    const titleInput = document.getElementById('title');
    const newName = titleInput ? titleInput.value : originalName;
    
    // Update the sequence
    sequences[index].name = newName;
    sequences[index].poses = editingFlow.asanas.map(asana => {
        const newAsana = new YogaAsana(
            asana.name,
            asana.side,
            asana.image,
            asana.description,
            asana.difficulty,
            [...asana.tags],
            [...asana.transitionsAsana],
            asana.sanskrit,
            asana.chakra || ""
        );
        newAsana.setDuration(asana.duration);
        return newAsana;
    });
    
    // Save back to localStorage
    localStorage.setItem('sequences', JSON.stringify(sequences));
    
    // Update UI
    displaySequences();
    populateAsanaList();
    
    // Show notification
    showToastNotification(`Sequence "${newName}" updated successfully`);
}

// Function to load a sequence into the current flow
function loadSequence(sequenceId) {
    const sequences = getSequences();
    const sequence = sequences.find(seq => seq.id === sequenceId);
    
    if (!sequence) {
        showToastNotification('Sequence not found');
        return;
    }

    // Create new asanas from the sequence
    const newAsanas = sequence.poses.map(asana => {
        const newAsana = new YogaAsana(
            asana.name,
            asana.side,
            asana.image,
            asana.description,
            asana.difficulty,
            [...asana.tags],
            [...asana.transitionsAsana],
            asana.sanskrit,
            asana.chakra || ""
        );
        newAsana.setDuration(asana.duration);
        return newAsana;
    });

    // Add poses based on sort order
    if (tableInDescendingOrder) {
        editingFlow.asanas.unshift(...newAsanas);
    } else {
        editingFlow.asanas.push(...newAsanas);
    }

    // Rebuild the table
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Loaded sequence "${sequence.name}"`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
        
        // If we're editing a sequence that appears in the asana list, refresh the list
        if (editingFlow.editingSequenceId) {
            populateAsanaList();
        }
    }
}

// Function to display sequences in the UI
function displaySequences() {
    const sequences = getSequences();
    const sequencesList = document.getElementById('sequencesList');
    
    if (!sequencesList) return;
    
    if (sequences.length === 0) {
        sequencesList.innerHTML = '<div class="empty-message"><p>No saved sequences</p></div>';
        return;
    }
    
    sequencesList.innerHTML = sequences.map(sequence => {
        // Get first three pose names
        const poseNames = sequence.poses.slice(0, 3).map(p => p.name);
        // Add ellipsis if there are more than 3 poses
        const description = sequence.poses.length > 3 
            ? `${poseNames.join(', ')}...` 
            : poseNames.join(', ');
        
        return `
        <div class="sequence-item">
            <div class="sequence-info">
                <h4>${sequence.name}</h4>
                <p class="sequence-description">${sequence.poses.length} poses</p>
                <div class="sequence-timestamps">
                    <span class="timestamp">${description}</span>
                </div>
            </div>
            <div class="sequence-actions">
                <button class="flow-btn" onclick="loadSequence('${sequence.id}')">LOAD</button>
                <button class="table-btn remove-btn" onclick="deleteSequence('${sequence.id}')">x</button>
            </div>
        </div>
    `}).join('');
}

// Function to add a custom pose
function addCustomPose() {
    // Show a prompt for the pose name
    const poseName = prompt('Enter the name of your custom pose:');
    if (!poseName) return; // User cancelled

    // Create a new YogaAsana instance
    const customPose = new YogaAsana(
        poseName,
        'Center', // Default side
        'images/webp/no-image.webp', // Use no-image.webp for custom poses
        'Custom pose', // Default description
        'Beginner', // Default difficulty
        ['Custom'], // Default tags
        [], // No transitions by default
        '', // No Sanskrit name by default
        '' // No chakra by default
    );
    customPose.setDuration(7); // Default duration

    // Add to the flow based on sort order
    if (tableInDescendingOrder) {
        editingFlow.asanas.unshift(customPose);
    } else {
        editingFlow.addAsana(customPose);
    }

    // Rebuild the table
    rebuildFlowTable();

    // Update flow duration
    updateFlowDuration();

    // Show notification
    showToastNotification(`Added custom pose: ${poseName}`);

    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}
