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

function getCustomPoses() {
    try {
        const customPosesJson = localStorage.getItem('customPoses');
        console.log('Raw custom poses data from localStorage:', customPosesJson);
        
        if (!customPosesJson) {
            console.log('No custom poses found in localStorage');
            return [];
        }
        
        const customPoses = JSON.parse(customPosesJson);
        console.log('Parsed custom poses:', customPoses);
        
        if (!Array.isArray(customPoses)) {
            console.error('Custom poses is not an array:', customPoses);
            return [];
        }
        
        // Convert plain objects back to YogaAsana instances
        return customPoses.map(pose => new YogaAsana(
            pose.name,
            pose.side,
            pose.image,
            pose.description,
            pose.difficulty,
            pose.tags,
            pose.transitionsAsana,
            pose.sanskrit,
            pose.chakra
        ));
    } catch (error) {
        console.error('Error getting custom poses from localStorage:', error);
        return [];
    }
}

function saveCustomPoses(customPoses) {
    try {
        if (!Array.isArray(customPoses)) {
            console.error('Cannot save custom poses: not an array', customPoses);
            return;
        }
        
        const customPosesJson = JSON.stringify(customPoses);
        localStorage.setItem('customPoses', customPosesJson);
        console.log('Saved custom poses to localStorage:', customPosesJson);
    } catch (error) {
        console.error('Error saving custom poses to localStorage:', error);
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
            asanaIds: [], // Store IDs of asanas in this section
            collapsed: false // Track collapsed state
        };
        
        // Add the section to the flow
        this.sections.push(section);
        
        return sectionId;
    }
    
    // Reorder a section by moving it from one position to another
    reorderSection(sourceSectionId, targetRow) {
        // Find the source section
        const sourceSection = this.sections.find(section => section.id === sourceSectionId);
        if (!sourceSection) {
            console.error('Source section not found:', sourceSectionId);
            return false;
        }
        
        console.log(`Moving section "${sourceSection.name}" with ${sourceSection.asanaIds.length} poses`);
        
        // Get all poses in this section (sorted by their current indices)
        const sectionPoseIndices = [...sourceSection.asanaIds].sort((a, b) => a - b);
        if (sectionPoseIndices.length === 0) {
            console.log('Section has no poses');
            return false;
        }
        
        // Determine the exact target position based on where it was dropped
        let targetIndex;
        
        if (targetRow.classList.contains('section-header')) {
            // Dropped on another section header - place before that section's first pose
            const targetSectionId = targetRow.getAttribute('data-section-id');
            const targetSection = this.sections.find(s => s.id === targetSectionId);
            if (targetSection && targetSection.asanaIds.length > 0) {
                // Find the lowest index in the target section
                targetIndex = Math.min(...targetSection.asanaIds);
            } else {
                console.error('Target section not found or empty');
                return false;
            }
        } else {
            // Dropped on a regular pose row - get its exact index
            targetIndex = parseInt(targetRow.getAttribute('data-index'));
            if (isNaN(targetIndex)) {
                console.error('Invalid target index');
                return false;
            }
        }
        
        console.log(`Target index position: ${targetIndex}`);
        
        // Store references to all poses with their original section assignments
        const poseToSectionMap = new Map();
        
        // First, map ALL poses to their current sections BEFORE any modifications
        this.asanas.forEach((pose, index) => {
            // Find which section this pose belongs to
            const belongsToSection = this.sections.find(section => 
                section.asanaIds.includes(index)
            );
            if (belongsToSection) {
                poseToSectionMap.set(pose, belongsToSection.id);
            }
        });
        
        // Extract the poses we're moving
        const sectionPoses = sectionPoseIndices.map(idx => this.asanas[idx]);
        
        // Remove all section poses from their current positions (in reverse order to maintain indices)
        const sortedIndicesDesc = [...sectionPoseIndices].sort((a, b) => b - a);
        sortedIndicesDesc.forEach(idx => {
            this.asanas.splice(idx, 1);
        });
        
        // Calculate the adjusted target index after removals
        let adjustedTargetIndex = targetIndex;
        sectionPoseIndices.forEach(idx => {
            if (idx < targetIndex) {
                adjustedTargetIndex--;
            }
        });
        
        // Ensure the adjusted target index is within bounds
        adjustedTargetIndex = Math.max(0, Math.min(adjustedTargetIndex, this.asanas.length));
        
        console.log(`Adjusted target index after removals: ${adjustedTargetIndex}`);
        
        // Insert all section poses at the target position
        this.asanas.splice(adjustedTargetIndex, 0, ...sectionPoses);
        
        // Now rebuild ALL section asanaIds from scratch
        // Clear all section asanaIds first
        this.sections.forEach(section => {
            section.asanaIds = [];
        });
        
        // Rebuild section asanaIds based on the pose-to-section mapping
        this.asanas.forEach((pose, index) => {
            const sectionId = poseToSectionMap.get(pose);
            if (sectionId) {
                const section = this.sections.find(s => s.id === sectionId);
                if (section) {
                    section.asanaIds.push(index);
                }
            }
        });
        
        console.log('Section reordering completed');
        console.log(`Moved section "${sourceSection.name}" to position ${adjustedTargetIndex}`);
        
        // Log the new state
        console.log('Updated sections:');
        this.sections.forEach((section, index) => {
            console.log(`  ${index + 1}. "${section.name}" - ${section.asanaIds.length} poses at indices: ${section.asanaIds.join(', ')}`);
        });
        
        return true;
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
        // Access the global tableInDescendingOrder variable
        if (typeof tableInDescendingOrder !== 'undefined' && tableInDescendingOrder) {
            // In descending mode, add to the end (highest number)
            this.asanas.push(asana);
        } else {
            // In ascending mode (default), add to the beginning (position 1)
            this.asanas.unshift(asana);
            
            // Update section indices when adding to the beginning
            if (this.sections && Array.isArray(this.sections)) {
                this.sections.forEach(section => {
                    if (section.asanaIds && Array.isArray(section.asanaIds)) {
                        // Bump all section asanaIds by 1
                        section.asanaIds = section.asanaIds.map(id => id + 1);
                    }
                });
            }
        }
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

// Track the last moved pose for highlighting
let lastMovedPoseIndex = null;
let currentAsanaIndex = 0;
let isReversed = false;
let paused = false;
let pausedBeforeEndFlow = false; // Track pause state before showing End Flow modal
let lastUpdateTime = 0;
let animationFrameId = null;
let startTimerInterval = null; // Track the starting countdown interval
let startCountdownValue = 0; // Track current countdown value
let isInStartingCountdown = false; // Track if we're in the 3-2-1 countdown
let speechEnabled = false; // Default to speech disabled
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let useSanskritNames = localStorage.getItem('useSanskritNames') === 'true';
let currentViewMode = localStorage.getItem('viewMode') || 'table'; // Default to table view
let confettiAnimationId = null; // For tracking confetti animation
let flowStartTime = null; // Track when flow started
let totalFlowDuration = 0; // Total duration of all poses in flow
let flowElapsedTime = 0; // Time elapsed since flow started

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
    
    // Only display the largest time increment
    if (hrs > 0) {
        return hrs.toString() + "h";
    }
    
    if (mins > 0) {
        return mins.toString() + "m";
    }
    
    return sec.toString() + "s";
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
    console.log('Clearing build flow...');
    
    // Reset form fields
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    
    if (titleInput) {
        titleInput.value = '';
        // Setup input event listeners for autosave
        titleInput.removeEventListener('input', autoSaveFlow);
        titleInput.addEventListener('input', autoSaveFlow);
    }
    
    if (descriptionInput) {
        descriptionInput.value = '';
        // Setup input event listeners for autosave
        descriptionInput.removeEventListener('input', autoSaveFlow);
        descriptionInput.addEventListener('input', autoSaveFlow);
    }
    
    // Clear flow table completely
    const table = document.getElementById('flowTable');
    if (table) {
        console.log('Clearing table, current rows:', table.rows.length);
        // Clear all rows to ensure complete reset
        table.innerHTML = '';
        
        // Recreate the header row
        const headerRow = table.insertRow(0);
        headerRow.innerHTML = `
            <th onclick="sortTableByLargestNumber()" style="cursor: pointer;" title="Click to sort by largest number first">#</th>
            <th>
                <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll(this)">
                <label for="selectAllCheckbox" style="display: none;">Select All</label>
            </th>
            <th>Asana</th>
            <th>Duration</th>
            <th>Side</th>
            <th>Swap</th>
            <th>Remove</th>
        `;
        
        console.log('Table cleared and header recreated, final rows:', table.rows.length);
    }
    
    // Reset flow duration
    const flowTime = document.getElementById('flowTime');
    if (flowTime) {
        flowTime.textContent = displayFlowDuration(0);
    }
    
    // Create a completely new flow and ensure it's empty
    editingFlow = new Flow();
    editingFlow.asanas = []; // Explicitly clear asanas array
    editingFlow.sections = []; // Explicitly clear sections array
    editingFlow.time = 0; // Reset time
    editMode = false;
    
    // Hide recommended poses section
    hideRecommendedPoses();
    
    console.log('Flow cleared, new flow object:', editingFlow);
}

// Screen management
function changeScreen(screenId) {
    console.log(`Changing screen to: ${screenId}`);
    // Remove flow-mode class when changing screens
    document.body.classList.remove('flow-mode');
    
    // Clear all timers when leaving flow screen
    if (currentScreenId === 'flowScreen' && screenId !== 'flowScreen') {
        // Clear all flow timers
        clearFlowTimers();
        
        // Clear the resume timer function
        if (window.resumeTimer) {
            window.resumeTimer = null;
        }
        
        // Stop any speech synthesis
        if (speechSynthesis) {
            speechSynthesis.cancel();
        }
        
        // Clean up flow controls event listeners
        cleanupFlowControlsAutoHide();
    }
    
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    
    if (!targetScreen) {
        console.error(`Screen with ID ${screenId} not found`);
        return;
    }
    
    targetScreen.classList.add('active');
    currentScreenId = screenId;

    // Clean up any lingering countdown elements when entering flow screen
    if (screenId === 'flowScreen') {
        // Remove any existing countdown display elements
        const existingCountdownDisplay = document.getElementById('countdown-display');
        if (existingCountdownDisplay) {
            const circleContainer = existingCountdownDisplay.parentElement;
            if (circleContainer && circleContainer.style.borderRadius === '50%') {
                circleContainer.remove();
            } else {
                existingCountdownDisplay.remove();
            }
        }
        
        // Remove countdown animations
        const countdownAnimations = document.getElementById('countdown-animations');
        if (countdownAnimations) {
            countdownAnimations.remove();
        }
        
        // Make sure the asana image is visible
        const asanaImage = document.getElementById('asanaImage');
        if (asanaImage) {
            asanaImage.style.display = 'block';
        }
    }

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
    
    // Create a completely new flow object and ensure it's empty
    editingFlow = new Flow();
    editingFlow.asanas = []; // Explicitly clear asanas array
    editingFlow.sections = []; // Explicitly clear sections array
    editingFlow.time = 0; // Reset time
    editMode = false;
    
    // Hide recommended poses section
    hideRecommendedPoses();
    
    console.log('Created new empty flow:', editingFlow);
    
    // Switch to build screen (this will call clearBuildAFlow automatically)
    console.log('Switching to build screen...');
    changeScreen('buildScreen');
    
    // Additional cleanup after screen change to ensure table is completely empty
    setTimeout(() => {
        console.log('Final cleanup after screen change...');
        
        // Ensure the flow object is still empty
        editingFlow.asanas = [];
        editingFlow.sections = [];
        editingFlow.time = 0;
        
        // Double-check table is empty and recreate if needed
        const table = document.getElementById('flowTable');
        if (table) {
            console.log('Final table check. Current rows:', table.rows.length);
            
            // If there are more than 1 row (header), clear everything and recreate
            if (table.rows.length > 1) {
                console.log('Table has extra rows, clearing completely...');
                table.innerHTML = '';
                
                // Recreate the header row
                const headerRow = table.insertRow(0);
                headerRow.innerHTML = `
                    <th onclick="sortTableByLargestNumber()" style="cursor: pointer;" title="Click to sort by largest number first">#</th>
                    <th>
                        <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll(this)">
                        <label for="selectAllCheckbox" style="display: none;">Select All</label>
                    </th>
                    <th>Asana</th>
                    <th>Duration</th>
                    <th>Side</th>
                    <th>Swap</th>
                    <th>Remove</th>
                `;
                
                console.log('Table completely reset. Final rows count:', table.rows.length);
            }
        }
        
        // Reset flow duration display
        const flowTime = document.getElementById('flowTime');
        if (flowTime) {
            flowTime.textContent = displayFlowDuration(0);
        }

        // Clear any highlighted poses
        const allPoses = document.querySelectorAll('.asana-item');
        allPoses.forEach(pose => {
            pose.classList.remove('highlight');
        });
    }, 150); // Slight delay to ensure everything else has run
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
    
    // Add pose based on table ordering
    if (tableInDescendingOrder) {
        // When table is in descending order (largest to smallest),
        // add pose to the end of the array so it appears at the largest position number
        editingFlow.asanas.push(newAsana);
    } else {
        // When table is in ascending order (smallest to largest),
        // add pose to the beginning of the array so it appears at position 1
        editingFlow.asanas.unshift(newAsana);
        
        // Update section indices to account for the new pose at the beginning
        editingFlow.sections.forEach(section => {
            // Bump all section asanaIds by 1
            section.asanaIds = section.asanaIds.map(id => id + 1);
        });
    }
    
    // Rebuild the table to ensure proper order and numbering
    rebuildFlowTable();
    
    // Get the row corresponding to the newly added pose
    let rowIndex = tableInDescendingOrder ? table.rows.length - 1 : 1; // First or last row based on order
    let row = table.rows[rowIndex];
    
    updateFlowDuration();
    
    console.log(`Added asana: ${asana.name} to the flow. Current asanas:`, editingFlow.asanas);
    
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
    
    // Show recommended poses based on the selected asana
    showRecommendedPoses(asana);
}

// Function to show recommended poses based on the selected asana
function showRecommendedPoses(selectedAsana) {
    const recommendedList = document.getElementById('recommendedPosesList');
    const toggleBtn = document.getElementById('recommendedToggleBtn');
    
    if (!recommendedList || !toggleBtn) {
        console.error('Recommended poses elements not found');
        return;
    }
    
    // Get transition recommendations from the selected asana
    const transitions = selectedAsana.transitionsAsana || [];
    
    if (transitions.length === 0) {
        // Hide the toggle button if no recommendations
        hideRecommendedPoses();
        return;
    }
    
    // Clear existing recommendations
    recommendedList.innerHTML = '';
    
    // Update the description to show which pose the recommendations are based on
    const description = document.querySelector('.recommended-panel-description');
    if (description) {
        description.textContent = `Based on "${selectedAsana.name}"`;
    }
    
    // Create recommended pose items
    transitions.forEach(transitionName => {
        // Find the transition pose in the asanas array
        const transitionPose = asanas.find(asana => 
            asana.name.toLowerCase() === transitionName.toLowerCase()
        );
        
        if (transitionPose) {
            const poseItem = createRecommendedPoseItem(transitionPose);
            recommendedList.appendChild(poseItem);
        }
    });
    
    // Show the toggle button
    toggleBtn.style.display = 'flex';
}

// Function to create a recommended pose item element
function createRecommendedPoseItem(asana) {
    const poseItem = document.createElement('div');
    poseItem.className = 'recommended-pose-item';
    
    // Create the pose image
    const img = document.createElement('img');
    img.className = 'recommended-pose-img';
    img.src = asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`;
    img.alt = asana.name;
    
    // Add error handling for missing images
    img.onerror = function() {
        this.src = asana.image.replace('webp', 'png').replace('.webp', '.png');
    };
    
    // Create the pose name
    const name = document.createElement('div');
    name.className = 'recommended-pose-name';
    name.textContent = asana.name;
    
    // Add click event to add the pose to the flow
    poseItem.addEventListener('click', function() {
        selectAsana(asana);
        
        // Add visual feedback
        poseItem.style.transform = 'scale(0.95)';
        setTimeout(() => {
            poseItem.style.transform = '';
        }, 150);
    });
    
    // Append elements
    poseItem.appendChild(img);
    poseItem.appendChild(name);
    
    return poseItem;
}

// Function to hide recommended poses section
function hideRecommendedPoses() {
    const toggleBtn = document.getElementById('recommendedToggleBtn');
    const sidePanel = document.getElementById('recommendedSidePanel');
    
    if (toggleBtn) {
        toggleBtn.style.display = 'none';
        toggleBtn.classList.remove('panel-open');
    }
    
    if (sidePanel) {
        sidePanel.classList.remove('open');
    }
}

// Function to toggle the recommended poses side panel
function toggleRecommendedPanel() {
    const sidePanel = document.getElementById('recommendedSidePanel');
    const toggleBtn = document.getElementById('recommendedToggleBtn');
    
    if (!sidePanel || !toggleBtn) {
        console.error('Panel elements not found');
        return;
    }
    
    const isOpen = sidePanel.classList.contains('open');
    
    if (isOpen) {
        // Close panel
        sidePanel.classList.remove('open');
        toggleBtn.classList.remove('panel-open');
    } else {
        // Open panel
        sidePanel.classList.add('open');
        toggleBtn.classList.add('panel-open');
    }
}

// Function to create a side dropdown menu
function createSideDropdown(side) {
    // Convert Center to Front for display, but maintain compatibility
    const displaySide = side === "Center" ? "Front" : side;
    
    return `<select class="side-select" onchange="updateAsanaImageOrientation(this)">
        <option value="Front" ${(side === "Center" || side === "Front") ? "selected" : ""}>Front</option>
        <option value="Back" ${side === "Back" ? "selected" : ""}>Back</option>
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
    
    // Update the asana in the editingFlow using data-index attribute
    const asanaIndex = parseInt(row.getAttribute('data-index'));
    if (!isNaN(asanaIndex) && asanaIndex >= 0 && editingFlow && editingFlow.asanas && asanaIndex < editingFlow.asanas.length) {
        // Map Front back to Center for internal storage consistency with XML
        const mappedSide = selectElement.value === "Front" ? "Center" : selectElement.value;
        editingFlow.asanas[asanaIndex].side = mappedSide;
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    }
}

// Track whether table is in descending order (initialized to true so the first click sorts ascending)
let tableInDescendingOrder = false;

// UI update functions
function updateRowNumbers() {
    const table = document.getElementById("flowTable");
    if (!table) return;
    
    const rows = Array.from(table.rows).slice(1);
    const totalRows = rows.length;
    
    rows.forEach((row, index) => {
        // Skip section headers for numbering
        if (row.classList.contains('section-header')) {
            row.setAttribute("draggable", "true");
            return;
        }
        
        // If in descending order, number from highest to lowest
        if (tableInDescendingOrder) {
            row.cells[0].innerHTML = totalRows - index;
        } else {
            row.cells[0].innerHTML = index + 1;
        }
        
        // Add drag attributes for every row but DON'T overwrite data-index
        // because it's already correctly set during table creation
        row.setAttribute("draggable", "true");
        // REMOVED: row.setAttribute("data-index", index); 
        // The data-index should already be correctly set to the actual asana index
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
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child):not(.section-header)');
    rows.forEach(row => {
        // Use the data-index attribute to get the correct asana index
        const asanaIndex = parseInt(row.getAttribute('data-index'));
        
        // Make sure the index is valid and the asana exists
        if (!isNaN(asanaIndex) && asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            if (durationInput) {
                editingFlow.asanas[asanaIndex].duration = parseInt(durationInput.value) || 7;
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
    
    // Update group header durations
    updateGroupHeaderDurations();
}

// Function to update all group header durations
function updateGroupHeaderDurations() {
    const sectionHeaders = document.querySelectorAll('#flowTable tr.section-header');
    
    sectionHeaders.forEach(headerRow => {
        const sectionId = headerRow.getAttribute('data-section-id');
        if (!sectionId) return;
        
        // Get all poses in this section
        const sectionRows = document.querySelectorAll(`#flowTable tr[data-section-id="${sectionId}"]:not(.section-header)`);
        
        // Calculate total duration for this section
        let sectionDuration = 0;
        let poseCount = 0;
        
        sectionRows.forEach(row => {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            if (durationInput) {
                sectionDuration += parseInt(durationInput.value) || 7;
                poseCount++;
            }
        });
        
        // Update the section header display
        const sectionDurationDisplay = displayFlowDuration(sectionDuration);
        const sectionCountDurationSpan = headerRow.querySelector('.section-count-duration');
        
        if (sectionCountDurationSpan) {
            sectionCountDurationSpan.textContent = `${poseCount} pose${poseCount !== 1 ? 's' : ''} - ${sectionDurationDisplay}`;
        }
    });
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

                // Update section references to account for the removed pose
                editingFlow.sections.forEach(section => {
                    // First, remove any direct references to the deleted pose
                    section.asanaIds = section.asanaIds.filter(asanaId => asanaId !== dataIndex);
                    
                    // Then, adjust the indices of the remaining poses to account for the removed pose
                    section.asanaIds = section.asanaIds.map(asanaId => {
                        // If this asana index is after the deleted index, decrement it
                        return asanaId > dataIndex ? asanaId - 1 : asanaId;
                    });
                });

                // Rebuild the entire view to ensure proper order and numbering
                rebuildFlowTable();

                // Update flow duration
                updateFlowDuration();

                // Refresh the asana list
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
            
            // Update section references to account for the removed pose
            editingFlow.sections.forEach(section => {
                // First, remove any direct references to the deleted pose
                section.asanaIds = section.asanaIds.filter(asanaId => asanaId !== dataIndex);
                
                // Then, adjust the indices of the remaining poses to account for the removed pose
                section.asanaIds = section.asanaIds.map(asanaId => {
                    // If this asana index is after the deleted index, decrement it
                    return asanaId > dataIndex ? asanaId - 1 : asanaId;
                });
            });
        } else {
            // Fallback to using row index if data-index is invalid
            const arrayIndex = rowIndex - 1;
            if (arrayIndex >= 0 && arrayIndex < editingFlow.asanas.length) {
                editingFlow.asanas.splice(arrayIndex, 1);
                
                // Update section references to account for the removed pose
                editingFlow.sections.forEach(section => {
                    // First, remove any direct references to the deleted pose
                    section.asanaIds = section.asanaIds.filter(asanaId => asanaId !== arrayIndex);
                    
                    // Then, adjust the indices of the remaining poses to account for the removed pose
                    section.asanaIds = section.asanaIds.map(asanaId => {
                        // If this asana index is after the deleted index, decrement it
                        return asanaId > arrayIndex ? asanaId - 1 : asanaId;
                    });
                });
            }
        }

        // Rebuild the entire table to ensure proper order and numbering
        rebuildFlowTable();

        // Update flow duration
        updateFlowDuration();

        // Refresh the asana list
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
        const modal = document.getElementById('saveFlowTitleModal');
        if (modal) {
            modal.style.display = 'block';
        }
        return;
    }

    editingFlow.name = title;
    editingFlow.description = description;
    editingFlow.calculateTotalDuration();
    
    // Update lastEdited timestamp
    editingFlow.lastEdited = new Date().toISOString();

    // Update asana durations and sides from input fields using data-index
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child):not(.section-header)');
    rows.forEach((row) => {
        const asanaIndex = parseInt(row.getAttribute('data-index'));
        if (!isNaN(asanaIndex) && asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            const sideSelect = row.querySelector('select.side-select');
            
            if (durationInput && sideSelect) {
                editingFlow.asanas[asanaIndex].duration = parseInt(durationInput.value) || 7;
                // Map Front back to Center for internal storage consistency with XML
                const mappedSide = sideSelect.value === "Front" ? "Center" : sideSelect.value;
                editingFlow.asanas[asanaIndex].side = mappedSide;
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

async function displayFlows() {
    let flows = getFlows();
    console.log('Raw flows:', flows); // Debug log
    
    // Filter out any corrupted flow data that might contain table elements
    flows = flows.filter(flow => {
        if (!flow || typeof flow !== 'object') {
            console.warn('Removing invalid flow object:', flow);
            return false;
        }
        if (typeof flow.name === 'string' && flow.name.includes('<th>')) {
            console.warn('Removing corrupted flow with table header in name:', flow.name);
            return false;
        }
        if (typeof flow.description === 'string' && flow.description.includes('<th>')) {
            console.warn('Removing corrupted flow with table header in description:', flow.description);
            return false;
        }
        return true;
    });
    
    // If we filtered out any corrupted flows, save the cleaned data back to localStorage
    const originalFlowCount = getFlows().length;
    if (flows.length < originalFlowCount) {
        console.log(`Cleaned ${originalFlowCount - flows.length} corrupted flows from localStorage`);
        saveFlows(flows);
    }
    
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
        console.log('No flows available - checking for default flow import');
        await importDefaultFlowForNewUser();
        // Refresh flows after potential import
        flows = getFlows();
        
        if (flows.length === 0) {
            flowList.innerHTML = '<div class="empty-message"><p>No flows available.</p><button class="primary-btn" onclick="startNewFlow()">Build your first flow</button></div>';
        } else {
            // Display the imported default flow using the same logic as the main section
            console.log(`Adding ${flows.length} flows to the list`);
            flows.forEach(flow => {
                const flowItem = document.createElement('div');
                flowItem.className = 'flow-item';
                
                const lastFlowed = flow.lastFlowed ? new Date(flow.lastFlowed) : null;
                const lastEdited = flow.lastEdited ? new Date(flow.lastEdited) : null;
                
                const lastFlowedText = lastFlowed ? formatTimeAgo(lastFlowed) : 'Never';
                const lastEditedText = lastEdited ? formatTimeAgo(lastEdited) : 'Unknown';
                
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
                        <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')" title="Delete this flow">🗑️</button>
                    </div>
                `;
                
                flowList.appendChild(flowItem);
            });
        }
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
                    <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')" title="Delete this flow">🗑️</button>
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

let flowToDelete = null;

function deleteFlow(flowID) {
    flowToDelete = flowID;
    const modal = document.getElementById('deleteFlowModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDeleteFlowModal() {
    const modal = document.getElementById('deleteFlowModal');
    if (modal) {
        modal.style.display = 'none';
    }
    flowToDelete = null;
}

function confirmDeleteFlow() {
    if (flowToDelete) {
        let flows = getFlows();
        flows = flows.filter(flow => flow.flowID !== flowToDelete);
        saveFlows(flows);
        displayFlows();
        closeDeleteFlowModal();
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
            newAsana.setSide(asana.side || "Center");
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
        
        // Initialize flow tracking
        flowStartTime = Date.now();
        totalFlowDuration = editingFlow.asanas.reduce((sum, asana) => sum + (asana.duration || 7), 0);
        flowElapsedTime = 0;
        console.log("Total flow duration:", totalFlowDuration, "seconds");

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
                <svg class="countdown-svg" viewBox="0 0 120 120">
                    <!-- Outer circle for flow progress -->
                    <circle r="55" cx="60" cy="60" fill="transparent" stroke="#eee" stroke-width="6"></circle>
                    <circle id="flow-progress-circle" r="55" cx="60" cy="60" fill="transparent"
                            stroke="#ffb366" stroke-width="6" stroke-dasharray="345.6"
                            stroke-dashoffset="0" transform="rotate(-90 60 60)"></circle>
                    <!-- Inner circle for pose timer -->
                    <circle r="45" cx="60" cy="60" fill="transparent" stroke="#ddd" stroke-width="10"></circle>
                    <circle id="countdown-circle" r="45" cx="60" cy="60" fill="transparent"
                            stroke="#ff8c00" stroke-width="10" stroke-dasharray="282.7"
                            stroke-dashoffset="282.7" transform="rotate(-90 60 60)"></circle>
                </svg>
                <div id="countdown">3</div>
            `;

            // Clear any existing animation frame/timer
            if (animationFrameId) {
                clearTimeout(animationFrameId);
                animationFrameId = null;
            }

            // Start 3-second countdown
            startCountdownValue = 3;
            isInStartingCountdown = true;
            startTimerInterval = setInterval(() => {
                startCountdownValue--;
                const countdownElement = document.getElementById('countdown');
                if (countdownElement) {
                    countdownElement.textContent = startCountdownValue;
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
                        if (borderColors[startCountdownValue]) {
                            circleContainer.style.border = borderColors[startCountdownValue];
                        }

                        // Keep text color constant - using the orange theme color
                        countdownDisplay.style.color = '#ff8c00';

                        if (colors[startCountdownValue]) {
                            circleContainer.style.background = colors[startCountdownValue];
                        }
                    }

                    // Apply exit animation
                    countdownDisplay.style.opacity = '0';

                    // Set new number and apply entrance animation after short delay
                    setTimeout(() => {
                        countdownDisplay.textContent = startCountdownValue;

                        // Slight delay before entrance animation
                        setTimeout(() => {
                            countdownDisplay.style.opacity = '1';
                        }, 50);
                    }, 250);
                }

                asanaSide.textContent = "Starting in " + startCountdownValue;

                // Update circle animation
                const countdownCircle = document.getElementById('countdown-circle');
                if (countdownCircle) {
                    const circumference = 2 * Math.PI * 45;
                    const progress = startCountdownValue / 3;
                    const dashOffset = circumference * (1 - progress);
                    countdownCircle.style.strokeDasharray = circumference;
                    countdownCircle.style.strokeDashoffset = dashOffset;
                }

                if (startCountdownValue <= 0) {
                    clearInterval(startTimerInterval);
                    isInStartingCountdown = false;

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
                            <svg class="countdown-svg" viewBox="0 0 120 120">
                                <!-- Outer circle for flow progress -->
                                <circle r="55" cx="60" cy="60" fill="transparent" stroke="#eee" stroke-width="6"></circle>
                                <circle id="flow-progress-circle" r="55" cx="60" cy="60" fill="transparent"
                                        stroke="#ffb366" stroke-width="6" stroke-dasharray="345.6"
                                        stroke-dashoffset="0" transform="rotate(-90 60 60)"></circle>
                                <!-- Inner circle for pose timer -->
                                <circle r="45" cx="60" cy="60" fill="transparent" stroke="#ddd" stroke-width="10"></circle>
                                <circle id="countdown-circle" r="45" cx="60" cy="60" fill="transparent"
                                        stroke="#ff8c00" stroke-width="10" stroke-dasharray="282.7"
                                        stroke-dashoffset="0" transform="rotate(-90 60 60)"></circle>
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

function startCountdownTimer(duration, isResuming = false) {
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
    
    // Only reset the pause state when starting a new timer (not when resuming)
    if (!isResuming) {
        paused = false;
    }
    
    // Initialize time left
    let timeLeft = duration;
    countdownElement.textContent = displayFlowDuration(timeLeft);
    
    // Calculate the circle circumference (2 * PI * radius)
    const circumference = 2 * Math.PI * 45; // The circle has r=45
    const flowCircumference = 2 * Math.PI * 55; // The flow progress circle has r=55
    
    // Get flow progress circle
    const flowProgressCircle = document.getElementById('flow-progress-circle');
    
    // Reset the countdown animation with the new duration
    countdownCircle.style.strokeDasharray = circumference;
    countdownCircle.style.strokeDashoffset = "0";
    
    // Update flow progress circle if starting fresh (not resuming)
    if (!isResuming && flowProgressCircle) {
        flowProgressCircle.style.strokeDasharray = flowCircumference;
        // Calculate current flow progress
        const elapsedBeforeThisPose = editingFlow.asanas.slice(0, currentAsanaIndex).reduce((sum, asana) => sum + (asana.duration || 7), 0);
        const flowProgress = elapsedBeforeThisPose / totalFlowDuration;
        // Reverse direction: start at 0 and increase offset as progress increases
        const flowDashOffset = flowCircumference * flowProgress;
        flowProgressCircle.style.strokeDashoffset = flowDashOffset;
    }
    
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
            
            // Update flow progress circle
            if (flowProgressCircle && totalFlowDuration > 0) {
                // Calculate total elapsed time in the flow
                const elapsedBeforeThisPose = editingFlow.asanas.slice(0, currentAsanaIndex).reduce((sum, asana) => sum + (asana.duration || 7), 0);
                const currentPoseElapsed = duration - timeLeft;
                const totalElapsed = elapsedBeforeThisPose + currentPoseElapsed;
                
                // Calculate flow progress (0 to 1)
                const flowProgress = totalElapsed / totalFlowDuration;
                // Reverse direction: increase offset as progress increases
                const flowDashOffset = flowCircumference * flowProgress;
                flowProgressCircle.style.strokeDashoffset = flowDashOffset;
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
                    
                    // Reset the pose timer circle animation
                    if (countdownCircle) {
                        countdownCircle.style.strokeDasharray = circumference;
                        countdownCircle.style.strokeDashoffset = "0";
                    }
                    
                    // Flow progress circle continues without reset
                    
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
        
        // Schedule the next update only if not paused
        if (!paused) {
            animationFrameId = setTimeout(updateTimer, 1000);
        }
    };
    
    // Store the updateTimer function globally so we can resume it
    window.resumeTimer = function() {
        if (!paused && animationFrameId === null) {
            updateTimer();
        }
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
    const modal = document.getElementById('endFlowModal');
    if (modal) {
        modal.style.display = 'block';
        // Store the current pause state and pause the timer
        pausedBeforeEndFlow = paused;
        paused = true;
        
        // Clear the current timer to stop it immediately
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }
        
        // If we're in the starting countdown, pause it
        if (isInStartingCountdown && startTimerInterval) {
            clearInterval(startTimerInterval);
            startTimerInterval = null;
        }
    }
}

function closeEndFlowModal() {
    const modal = document.getElementById('endFlowModal');
    if (modal) {
        modal.style.display = 'none';
        // Restore the previous pause state
        const wasUnpaused = !pausedBeforeEndFlow;
        paused = pausedBeforeEndFlow;
        
        // If we're resuming the starting countdown
        if (isInStartingCountdown && wasUnpaused) {
            resumeStartingCountdown();
        }
        // If we're resuming the normal flow timer
        else if (wasUnpaused && typeof window.resumeTimer === 'function') {
            window.resumeTimer();
        }
    }
}

function resumeStartingCountdown() {
    // Resume the starting countdown from where it left off
    const asanaSide = document.getElementById('asanaSide');
    const countdownContainer = document.querySelector('.countdown-container');
    const asanaName = document.getElementById('asanaName');
    const asanaImage = document.getElementById('asanaImage');
    
    if (!editingFlow || !editingFlow.asanas || editingFlow.asanas.length === 0) return;
    
    const asana = editingFlow.asanas[currentAsanaIndex];
    
    startTimerInterval = setInterval(() => {
        startCountdownValue--;
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            countdownElement.textContent = startCountdownValue;
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

                // Border colors for each step
                const borderColors = {
                    2: '2px solid rgba(255, 140, 0, 0.6)',
                    1: '2px solid rgba(255, 0, 0, 0.6)',
                    0: '2px solid rgba(0, 200, 0, 0.6)'
                };

                // Apply border color
                if (borderColors[startCountdownValue]) {
                    circleContainer.style.border = borderColors[startCountdownValue];
                }

                // Keep text color constant - using the orange theme color
                countdownDisplay.style.color = '#ff8c00';
            }

            // Apply exit animation
            countdownDisplay.style.opacity = '0';

            // Set new number and apply entrance animation after short delay
            setTimeout(() => {
                countdownDisplay.textContent = startCountdownValue;

                // Slight delay before entrance animation
                setTimeout(() => {
                    countdownDisplay.style.opacity = '1';
                }, 50);
            }, 250);
        }

        asanaSide.textContent = "Starting in " + startCountdownValue;

        // Update circle animation
        const countdownCircle = document.getElementById('countdown-circle');
        if (countdownCircle) {
            const circumference = 2 * Math.PI * 45;
            const progress = startCountdownValue / 3;
            const dashOffset = circumference * (1 - progress);
            countdownCircle.style.strokeDasharray = circumference;
            countdownCircle.style.strokeDashoffset = dashOffset;
        }

        if (startCountdownValue <= 0) {
            clearInterval(startTimerInterval);
            isInStartingCountdown = false;

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

// Function to clear all flow-related timers
function clearFlowTimers() {
    // Clear the main flow timer
    if (animationFrameId) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
    }
    
    // Clear starting countdown if it exists
    if (startTimerInterval) {
        clearInterval(startTimerInterval);
        startTimerInterval = null;
        isInStartingCountdown = false;
        startCountdownValue = 0;
    }
    
    // Clear any countdown display elements
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        // Remove the parent circle container if it exists
        const circleContainer = countdownDisplay.parentElement;
        if (circleContainer && circleContainer.style.borderRadius === '50%') {
            circleContainer.remove();
        } else {
            countdownDisplay.remove();
        }
    }
    
    // Also remove any lingering countdown animations
    const countdownAnimations = document.getElementById('countdown-animations');
    if (countdownAnimations) {
        countdownAnimations.remove();
    }
    
    // Reset timer states
    paused = false;
    pausedBeforeEndFlow = false;
}

function confirmEndFlow() {
    // Clear all timers
    clearFlowTimers()

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

    // Close the modal
    closeEndFlowModal();

    // Return to home screen
    changeScreen('homeScreen');
}

function closeSaveFlowTitleModal() {
    const modal = document.getElementById('saveFlowTitleModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function returnHomeWithoutSaving() {
    // Clear any active timers
    clearFlowTimers();
    
    closeSaveFlowTitleModal();
    changeScreen('homeScreen');
    editingFlow = new Flow();
    editMode = false;
}

function focusTitleInput() {
    closeSaveFlowTitleModal();
    const titleInput = document.getElementById('title');
    if (titleInput) {
        titleInput.focus();
    }
}

function showGroupSkipAlert(message) {
    const modal = document.getElementById('groupSkipAlertModal');
    const messageElement = document.getElementById('groupSkipMessage');
    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.style.display = 'block';
    }
}

function closeGroupSkipAlertModal() {
    const modal = document.getElementById('groupSkipAlertModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to export a flow as a shareable string
function exportFlow(flowID) {
    console.log('exportFlow called with flowID:', flowID);
    
    // Get all flows from storage
    const flows = getFlows();
    console.log('All flows:', flows);
    console.log('Available flow IDs:', flows.map(f => f.flowID));

    // Find the flow with the given ID
    const flowToExport = flows.find(flow => flow.flowID === flowID);

    if (!flowToExport) {
        console.error(`Flow with ID ${flowID} not found`);
        console.error('Available flows:', flows.map(f => ({ id: f.flowID, name: f.name })));
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
            sections: flowToExport.sections || [], // Include sections (groups) in export
            timestamp: new Date().toISOString(),
            version: "1.0" // For future compatibility
        };

        // Convert to JSON string and encode as base64
        const jsonStr = JSON.stringify(exportData);
        console.log('JSON string length:', jsonStr.length);
        
        // Use btoa for base64 encoding (it's built into browsers)
        // First encode to handle UTF-8 characters properly
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        console.log('Successfully encoded share code, length:', encoded.length);

        return encoded;
    } catch (error) {
        console.error('Error exporting flow:', error);
        console.error('Export data that failed:', exportData);
        return null;
    }
}

// Function to import a flow from a shareable string
function importFlow(shareCode) {
    try {
        // Decode the base64 string and handle UTF-8 characters properly
        const jsonStr = decodeURIComponent(escape(atob(shareCode)));

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

        // Import sections (groups) if they exist
        if (importData.sections && Array.isArray(importData.sections)) {
            newFlow.sections = importData.sections.map(section => ({
                id: section.id || generateUniqueID(), // Generate new ID if missing
                name: section.name || "Unnamed Section",
                asanaIds: section.asanaIds || [] // Preserve asana IDs in sections
            }));
        }

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
                
                // Restart with the current remaining time, marking as resuming
                startCountdownTimer(remainingDuration, true);
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

    // Set edit mode early
    editMode = true;

    // Switch to build screen first for immediate visual feedback
    changeScreen('buildScreen');

    // Show loading state for very large flows (200+ poses)
    const table = document.getElementById('flowTable');
    if (table && flowToEdit.asanas && flowToEdit.asanas.length > 200) {
        table.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading flow...</td></tr>';
    }

    // Update form fields immediately for better UX
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');

    if (titleInput) {
        titleInput.value = editingFlow.name || '';
        titleInput.removeEventListener('input', autoSaveFlow);
        titleInput.addEventListener('input', autoSaveFlow);
    }
    
    if (descriptionInput) {
        descriptionInput.value = editingFlow.description || '';
        descriptionInput.removeEventListener('input', autoSaveFlow);
        descriptionInput.addEventListener('input', autoSaveFlow);
    }

    // Defer heavy asana processing to next frame
    requestAnimationFrame(() => {
        processFlowAsanasOptimized(flowToEdit);
    });

    console.log('Loading flow:', editingFlow.name, 'with', flowToEdit.asanas?.length || 0, 'asanas');
}

function processFlowAsanasOptimized(flowToEdit) {
    // Batch process asana objects for better performance
    if (editingFlow.asanas && Array.isArray(editingFlow.asanas)) {
        // Process in chunks to avoid blocking UI
        const chunkSize = 20;
        let currentIndex = 0;
        
        function processChunk() {
            const endIndex = Math.min(currentIndex + chunkSize, editingFlow.asanas.length);
            
            for (let i = currentIndex; i < endIndex; i++) {
                const asana = editingFlow.asanas[i];
                
                // Only create new instances if needed
                if (!(asana instanceof YogaAsana) || !asana.getDisplayName) {
                    editingFlow.asanas[i] = new YogaAsana(
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
                    editingFlow.asanas[i].setDuration(asana.duration || 7);
                    editingFlow.asanas[i].setSide(asana.side || "Center");
                }
            }
            
            currentIndex = endIndex;
            
            if (currentIndex < editingFlow.asanas.length) {
                // Continue processing in next frame
                requestAnimationFrame(processChunk);
            } else {
                // All asanas processed, now build the table
                rebuildFlowTableOptimized();
            }
        }
        
        processChunk();
    } else {
        // No asanas to process, build empty table
        rebuildFlowTableOptimized();
    }
}

// Global variable to store current flow ID for sharing
let currentShareFlowID = null;

// Show the share flow modal with export code
function showShareFlow(flowID) {
    // Store the flow ID for JSON export
    currentShareFlowID = flowID;
    
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
    // Clear the stored flow ID
    currentShareFlowID = null;
}

// Export flow as JSON from the share modal
function exportFlowAsJSONFromModal() {
    if (!currentShareFlowID) {
        alert('Error: No flow selected for export.');
        return;
    }
    
    try {
        // Get all flows from storage
        const flows = getFlows();
        
        // Find the flow with the given ID
        const flowToExport = flows.find(flow => flow.flowID === currentShareFlowID);
        
        if (!flowToExport) {
            console.error(`Flow with ID ${currentShareFlowID} not found`);
            alert('Flow not found. Please try again.');
            return;
        }
        
        // Create simplified JSON structure similar to templates
        const exportData = {
            name: flowToExport.name || "Untitled Flow",
            description: flowToExport.description || "",
            asanas: flowToExport.asanas.map(asana => {
                // Ensure each asana has a valid name for validation
                const asanaName = asana.imageName || asana.name.toLowerCase().replace(/\s+/g, '-');
                
                return {
                    name: asanaName || "unknown-pose",
                    english: asana.name || "Unknown Pose",
                    sanskrit: asana.sanskrit || "",
                    duration: Math.max(1, Math.min(300, asana.duration || 15)), // Ensure valid duration range
                    difficulty: asana.difficulty || "Beginner",
                    side: asana.side || "both",
                    description: asana.description || "",
                    tags: Array.isArray(asana.tags) ? asana.tags : [],
                    chakra: asana.chakra || "Root"
                };
            })
        };
        
        // Validate the export data before creating file (ensure it would pass import validation)
        const validationErrors = validateJSONContent(exportData);
        if (validationErrors.length > 0) {
            console.error('Export validation failed:', validationErrors);
            alert(`Export failed: ${validationErrors[0]}`);
            return;
        }
        
        // Convert to JSON string with formatting
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create temporary download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${flowToExport.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.flow`;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log('Flow exported as JSON successfully');
        
        // Close the modal after successful export
        closeShareModal();
        
    } catch (error) {
        console.error('Error exporting flow as JSON:', error);
        alert('Error exporting flow. Please try again.');
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
    
    // Clear file input and filename display
    const fileInput = document.getElementById('flowFileInput');
    const fileName = document.getElementById('fileName');
    if (fileInput) {
        fileInput.value = '';
    }
    if (fileName) {
        fileName.textContent = '';
    }
    
    // Clear import code input
    const importCodeInput = document.getElementById('importCodeInput');
    if (importCodeInput) {
        importCodeInput.value = '';
    }
    
    // Hide error message
    const importError = document.getElementById('importError');
    if (importError) {
        importError.style.display = 'none';
    }
}

// Security validation for imported files
function validateFileSecurely(file) {
    const errors = [];
    
    // File size validation (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
        errors.push('File size exceeds maximum limit of 10MB.');
    }
    
    // File type validation (MIME type check)
    const allowedTypes = ['application/json', 'text/plain', ''];
    if (file.type && !allowedTypes.includes(file.type)) {
        errors.push('Invalid file type. Only .flow and .json files are allowed.');
    }
    
    // File extension validation
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    if (fileExtension !== 'flow' && fileExtension !== 'json') {
        errors.push('Please select a .flow or .json file.');
    }
    
    // Filename validation (prevent path traversal)
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        errors.push('Invalid filename detected.');
    }
    
    return errors;
}

// Sanitize and validate JSON content
function validateJSONContent(data) {
    const errors = [];
    
    try {
        // Check if it's an object
        if (typeof data !== 'object' || data === null) {
            errors.push('Invalid file structure.');
            return errors;
        }
        
        // Validate required properties for flow files
        const requiredProps = ['name', 'asanas'];
        for (const prop of requiredProps) {
            if (!data.hasOwnProperty(prop)) {
                errors.push(`Missing required property: ${prop}`);
            }
        }
        
        // Validate name format
        if (data.name && typeof data.name !== 'string') {
            errors.push('Invalid name format.');
        }
        
        // Sanitize name (remove potentially dangerous characters)
        if (data.name) {
            data.name = data.name.replace(/[<>]/g, '').substring(0, 100);
        }
        
        // Validate title if present (optional for flow files)
        if (data.title && typeof data.title !== 'string') {
            errors.push('Invalid title format.');
        }
        
        // Sanitize title (remove potentially dangerous characters)
        if (data.title) {
            data.title = data.title.replace(/[<>]/g, '').substring(0, 100);
        }
        
        // Validate description
        if (data.description && typeof data.description !== 'string') {
            errors.push('Invalid description format.');
        }
        
        // Sanitize description
        if (data.description) {
            data.description = data.description.replace(/[<>]/g, '').substring(0, 500);
        }
        
        // Validate asanas array
        if (data.asanas && !Array.isArray(data.asanas)) {
            errors.push('Invalid asanas format.');
        }
        
        // Validate asanas content
        if (data.asanas && Array.isArray(data.asanas)) {
            data.asanas.forEach((asana, index) => {
                if (typeof asana !== 'object' || asana === null) {
                    errors.push(`Invalid asana at position ${index + 1}.`);
                    return;
                }
                
                // Validate and sanitize asana name
                if (asana.name && typeof asana.name === 'string') {
                    asana.name = asana.name.replace(/[<>]/g, '').substring(0, 100);
                } else if (asana.name) {
                    errors.push(`Invalid asana name at position ${index + 1}.`);
                }
                
                // Validate duration
                if (asana.duration && (typeof asana.duration !== 'number' || asana.duration < 0 || asana.duration > 300)) {
                    errors.push(`Invalid duration for asana at position ${index + 1}.`);
                }
            });
        }
        
        // Remove any potentially dangerous properties
        const dangerousProps = ['__proto__', 'constructor', 'prototype'];
        dangerousProps.forEach(prop => {
            delete data[prop];
        });
        
        // Validate total file structure size
        const jsonString = JSON.stringify(data);
        if (jsonString.length > 1024 * 1024) { // 1MB JSON limit
            errors.push('File content too large.');
        }
        
    } catch (error) {
        errors.push('Failed to validate file content.');
    }
    
    return errors;
}

// Handle file upload for .flow files
function handleFileUpload(event) {
    const file = event.target.files[0];
    const fileName = document.getElementById('fileName');
    const importError = document.getElementById('importError');
    
    // Hide any previous error messages
    if (importError) {
        importError.style.display = 'none';
    }
    
    if (!file) {
        if (fileName) {
            fileName.textContent = '';
        }
        return;
    }
    
    // Security validation
    const validationErrors = validateFileSecurely(file);
    if (validationErrors.length > 0) {
        if (importError) {
            importError.textContent = validationErrors[0];
            importError.style.display = 'block';
        }
        return;
    }
    
    // Display filename
    if (fileName) {
        fileName.textContent = file.name;
    }
    
    // Read and process the file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileContent = e.target.result;
            
            // Additional content length check
            if (fileContent.length > 1024 * 1024) { // 1MB
                throw new Error('File content too large');
            }
            
            const templateData = JSON.parse(fileContent);
            
            // Validate JSON content
            const contentErrors = validateJSONContent(templateData);
            if (contentErrors.length > 0) {
                if (importError) {
                    importError.textContent = contentErrors[0];
                    importError.style.display = 'block';
                }
                return;
            }
            
            // Import the flow using the same logic as template import
            importFlowFromData(templateData);
            
        } catch (error) {
            console.error('Error reading file:', error);
            if (importError) {
                importError.textContent = 'Invalid file format. Please check the file and try again.';
                importError.style.display = 'block';
            }
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading file');
        if (importError) {
            importError.textContent = 'Error reading file. Please try again.';
            importError.style.display = 'block';
        }
    };
    
    reader.readAsText(file);
}

// Drag and drop functionality
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
}

function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
        dropZone.classList.add('drag-over');
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Only remove drag-over if we're leaving the entire drop zone
    if (event.target === document.getElementById('fileDropZone')) {
        const dropZone = document.getElementById('fileDropZone');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
        }
    }
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
        dropZone.classList.remove('drag-over');
    }
    
    const importError = document.getElementById('importError');
    
    // Hide any previous error messages
    if (importError) {
        importError.style.display = 'none';
    }
    
    const files = event.dataTransfer.files;
    if (files.length === 0) {
        if (importError) {
            importError.textContent = 'No file detected. Please try again.';
            importError.style.display = 'block';
        }
        return;
    }
    
    // Only allow single file drops
    if (files.length > 1) {
        if (importError) {
            importError.textContent = 'Please drop only one file at a time.';
            importError.style.display = 'block';
        }
        return;
    }
    
    const file = files[0];
    
    // Security validation using the same function as file upload
    const validationErrors = validateFileSecurely(file);
    if (validationErrors.length > 0) {
        if (importError) {
            importError.textContent = validationErrors[0];
            importError.style.display = 'block';
        }
        return;
    }
    
    const fileName = document.getElementById('fileName');
    if (fileName) {
        fileName.textContent = file.name;
    }
    
    // Read and process the file directly
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileContent = e.target.result;
            
            // Additional content length check
            if (fileContent.length > 1024 * 1024) { // 1MB
                throw new Error('File content too large');
            }
            
            const templateData = JSON.parse(fileContent);
            
            // Validate JSON content
            const contentErrors = validateJSONContent(templateData);
            if (contentErrors.length > 0) {
                if (importError) {
                    importError.textContent = contentErrors[0];
                    importError.style.display = 'block';
                }
                return;
            }
            
            importFlowFromData(templateData);
        } catch (error) {
            console.error('Error reading dropped file:', error);
            if (importError) {
                importError.textContent = 'Invalid file format. Please check the file and try again.';
                importError.style.display = 'block';
            }
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading dropped file');
        if (importError) {
            importError.textContent = 'Error reading file. Please try again.';
            importError.style.display = 'block';
        }
    };
    
    // Add timeout for file reading operation
    const timeoutId = setTimeout(() => {
        reader.abort();
        if (importError) {
            importError.textContent = 'File reading timeout. Please try a smaller file.';
            importError.style.display = 'block';
        }
    }, 30000); // 30 second timeout
    
    reader.onloadend = function() {
        clearTimeout(timeoutId);
    };
    
    reader.readAsText(file);
}

// Import flow from template data (shared function for templates and file uploads)
function importFlowFromData(templateData) {
    try {
        // Convert template data to the format expected by the app
        const newFlow = new Flow(
            templateData.name,
            templateData.description || "",
            0, // time will be calculated from asanas
            "" // peakPose
        );
        
        // Add asanas to the flow
        templateData.asanas.forEach(asanaData => {
            const newAsana = new YogaAsana(
                asanaData.english || asanaData.name, // Use english name for display
                asanaData.side || "both",
                `images/webp/${asanaData.name}.webp`,
                asanaData.description || "",
                asanaData.difficulty || "Beginner",
                asanaData.tags || [],
                asanaData.transitionsAsana || [],
                asanaData.sanskrit || "",
                asanaData.chakra || "Root"
            );
            
            // Set the duration
            newAsana.setDuration(asanaData.duration || 15);
            
            // Store the original name for image reference
            newAsana.imageName = asanaData.name;
            
            newFlow.addAsana(newAsana);
        });
        
        // Calculate total time
        newFlow.time = newFlow.asanas.reduce((total, asana) => total + asana.duration, 0);
        
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
        
    } catch (error) {
        console.error('Error importing flow data:', error);
        
        // Show error message
        const importError = document.getElementById('importError');
        if (importError) {
            importError.textContent = 'Failed to import flow. Please check the file format and try again.';
            importError.style.display = 'block';
        }
    }
}

// Import a flow from a template file
async function importTemplate(templateFile) {
    try {
        const response = await fetch(`templates/${templateFile}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load template: ${response.status}`);
        }
        
        const templateData = await response.json();
        
        // Use the shared import function
        importFlowFromData(templateData);
        
    } catch (error) {
        console.error('Error importing template:', error);
        
        // Show error message
        const importError = document.getElementById('importError');
        if (importError) {
            importError.textContent = 'Failed to load template. Please try again.';
            importError.style.display = 'block';
        }
    }
}

// Import default C1 flow for new users
async function importDefaultFlowForNewUser() {
    try {
        // Check if user has previously used the app
        const hasUsedApp = localStorage.getItem('hasUsedApp');
        if (hasUsedApp === 'true') {
            console.log('User has used app before - not importing default flow');
            return;
        }
        
        console.log('Importing default C1 flow for new user');
        
        // Check if C1 flow template exists
        const response = await fetch('templates/c1.flow');
        if (!response.ok) {
            console.error('C1 template not found:', response.status);
            return;
        }
        
        const templateData = await response.json();
        
        // Import the C1 flow data
        importFlowFromData(templateData);
        
        // Mark user as having used the app
        localStorage.setItem('hasUsedApp', 'true');
        
        console.log('Default C1 flow imported successfully');
        
    } catch (error) {
        console.error('Error importing default C1 flow:', error);
        // Silently fail - don't show error to user as this is background functionality
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
        
        // Load custom poses from localStorage and add them to the asanas array
        const customPoses = getCustomPoses();
        asanas.push(...customPoses);
        console.log('Added custom poses from localStorage:', customPoses.length);
        
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
        
        // Load custom poses from localStorage and add them to the asanas array
        const customPoses = getCustomPoses();
        asanas.push(...customPoses);
        console.log('Added custom poses from localStorage:', customPoses.length);
        
        populateAsanaList();
    }
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
            const isCustomPose = asana.tags.includes('Custom');
            const badgeText = isCustomPose ? 'Custom' : asana.difficulty;
            const badgeClass = isCustomPose ? 'custom' : asana.difficulty.toLowerCase();
            difficultyBadge.className = `difficulty-badge ${badgeClass}`;
            difficultyBadge.textContent = badgeText;
            
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
            
            // Add delete button for custom poses
            if (isCustomPose) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'custom-pose-delete-btn';
                deleteButton.innerHTML = '×';
                deleteButton.title = `Delete custom pose: ${asana.name}`;
                deleteButton.onclick = function(e) {
                    e.stopPropagation(); // Prevent selecting the pose when clicking delete
                    deleteCustomPose(asana.name);
                };
                asanaElement.appendChild(deleteButton);
            }
            
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
            sequenceBadge.className = 'difficulty-badge sequence';
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
    rows.forEach((row) => { // Removed 'index' from parameters
        row.setAttribute('draggable', 'true');
        // row.setAttribute('data-index', index); // BUGFIX: data-index should not be reset here.
                                                // It's correctly set by rebuildTableView/addAsanaRow based on actual array index.
        
        // If this is a section header, make it draggable and style it
        if (row.classList.contains('section-header')) {
            // For section headers, make the section name act as a drag handle
            const sectionNameCell = row.querySelector('.section-name');
            if (sectionNameCell) {
                sectionNameCell.style.cursor = 'grab';
                sectionNameCell.setAttribute('title', 'Drag to reorder this group');
            }
        } 
        // For regular rows, style the first cell as a drag handle
        else {
            const firstCell = row.cells[0];
            if (firstCell) {
                firstCell.style.cursor = 'grab';
                firstCell.setAttribute('title', 'Drag to reorder');
            }
        }
    });
}

// Drag and drop event handlers
function handleTableDragStart(e) {
    console.log('------ DRAG START ------');
    
    // Clear the last moved pose indicator when starting a new drag
    lastMovedPoseIndex = null;
    
    // Find the row being dragged - either the target itself or its parent row
    let row = null;
    
    if (e.target.tagName === 'TR') {
        row = e.target;
    } else {
        row = e.target.closest('tr');
        
        // Check if this is a section header
        const isSectionHeader = row && row.classList.contains('section-header');
        
        if (isSectionHeader) {
            // For section headers, allow drag from the section name
            const sectionName = e.target.closest('.section-name');
            if (!sectionName) {
                console.log('⛔ Invalid drag source: Not dragging from section name');
                e.preventDefault();
                return false;
            }
        } else {
            // For regular rows, only allow drag from the first cell (position number)
            const cell = e.target.closest('td');
            if (!cell || cell.cellIndex !== 0) {
                console.log('⛔ Invalid drag source: Not dragging from first cell');
                e.preventDefault();
                return false;
            }
            
            // Display the pose number in the drag image
            const poseIndex = parseInt(row.getAttribute('data-index'));
            const displayNumber = row.cells[0].textContent.trim();
            
            // Log the pose information to console
            console.log(`Dragging pose number: ${displayNumber} (index: ${poseIndex})`);
            if (poseIndex >= 0 && poseIndex < editingFlow.asanas.length) {
                const pose = editingFlow.asanas[poseIndex];
                console.log(`Pose name: ${pose.name}`);
                console.log(`Pose duration: ${pose.duration} seconds`);
            }
            
            // Create a floating indicator showing the pose number being dragged
            const indicator = document.createElement('div');
            indicator.className = 'pose-drag-indicator';
            indicator.textContent = displayNumber;
            indicator.style.position = 'fixed';
            indicator.style.backgroundColor = '#ff8c00';
            indicator.style.color = 'white';
            indicator.style.padding = '8px 12px';
            indicator.style.borderRadius = '50%';
            indicator.style.fontWeight = 'bold';
            indicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            indicator.style.zIndex = '10000';
            indicator.style.fontSize = '18px';
            indicator.style.pointerEvents = 'none';
            indicator.id = 'pose-drag-indicator';
            document.body.appendChild(indicator);
            
            // Position it near the cursor
            const updateIndicatorPosition = (e) => {
                indicator.style.left = (e.clientX + 15) + 'px';
                indicator.style.top = (e.clientY + 15) + 'px';
            };
            
            // Initial position
            updateIndicatorPosition(e);
            
            // Update position during drag
            document.addEventListener('dragover', updateIndicatorPosition);
            
            // Remove indicator when drag ends
            document.addEventListener('dragend', function removeIndicator() {
                if (document.getElementById('pose-drag-indicator')) {
                    document.body.removeChild(indicator);
                }
                document.removeEventListener('dragover', updateIndicatorPosition);
                document.removeEventListener('dragend', removeIndicator);
            }, { once: true });
        }
    }
    
    if (!row || row.rowIndex === 0) {
        console.log('⛔ Invalid drag source: Header row or no row');
        e.preventDefault();
        return false; // Ignore header row
    }
    
    // Allow section headers to be dragged
    const isSectionHeader = row.classList.contains('section-header');
    console.log('🔄 Drag source type:', isSectionHeader ? 'GROUP HEADER' : 'POSE');
    
    // Store the section ID for later use during drop
    const sectionId = row.getAttribute('data-section-id');
    
    // If this is a section header, get the section ID from the data attribute
    const sectionHeaderId = isSectionHeader ? row.getAttribute('data-section-id') : null;
    
    // Get detailed information about what's being dragged
    if (isSectionHeader) {
        // For section headers, get the section name
        const sectionName = row.getAttribute('data-section');
        const section = editingFlow.getSectionById(sectionHeaderId);
        const poseCount = section ? section.asanaIds.length : 0;
        
        console.log(`📋 Dragging GROUP: "${sectionName}" (ID: ${sectionHeaderId})`);
        console.log(`   Contains ${poseCount} poses`);
    } else {
        // For regular rows, get the pose details
        const poseIndex = parseInt(row.getAttribute('data-index'));
        const pose = editingFlow.asanas[poseIndex];
        
        if (pose) {
            console.log(`📋 Dragging POSE: "${pose.name}" (Index: ${poseIndex})`);
            console.log(`   In group: ${sectionId ? 'Yes - ' + sectionId : 'No (ungrouped)'}`);
            
            if (sectionId) {
                const section = editingFlow.getSectionById(sectionId);
                if (section) {
                    console.log(`   Group name: "${section.name}"`);
                }
            }
        }
    }
    
    // Create a dragSource object with its own properties rather than extending the row
    // This ensures properties don't get lost during DOM operations
    const dragSourceObj = {
        element: row,
        sectionId: sectionId,
        isSectionHeader: isSectionHeader,
        sectionHeaderId: sectionHeaderId,
        getAttribute: function(attr) {
            return this.element.getAttribute(attr);
        },
        classList: {
            add: function(cls) { row.classList.add(cls); },
            remove: function(cls) { row.classList.remove(cls); },
            contains: function(cls) { return row.classList.contains(cls); }
        }
    };
    
    // Set the global dragSource
    dragSource = dragSourceObj;
    
    // Add the dragging class to the actual row
    row.classList.add('dragging');
    
    console.log(`Drag source set with sectionId: ${dragSource.sectionId || 'null (ungrouped)'}`);
    
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
    
    // Determine if we're dragging a section header
    const isDraggingSection = dragSource.isSectionHeader;
    
    // Remove visual feedback from all rows
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => {
        if (r !== dragSource) {
            r.classList.remove('drop-target', 'drop-target-section');
        }
    });
    
    // Don't add visual feedback to the drag source
    if (row === dragSource) return;
    
    // Add appropriate visual feedback based on what's being dragged
    if (isDraggingSection) {
        // When dragging a section, add special styling
        row.classList.add('drop-target-section');
    } else {
        // When dragging a regular pose, use standard styling
        row.classList.add('drop-target');
    }
}

function handleTableDragLeave(e) {
    // Only remove the class if we're leaving the row entirely, not just moving between cells
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.target.contains(relatedTarget)) {
        const row = e.target.closest('tr');
        if (row) {
            row.classList.remove('drop-target', 'drop-target-section');
        }
    }
}

function handleTableDrop(e) {
    e.preventDefault();
    console.log('------ DROP EVENT ------');
    
    // Check if we have a valid drag source
    if (!dragSource || !dragSource.element) {
        console.log('⛔ Error: No valid drag source');
        return;
    }
    
    let row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) {
        console.log('⛔ Error: Invalid drop target (header or not a row)');
        return; // Ignore header row
    }
    
    // Log drop target details
    if (row.classList.contains('section-header')) {
        const sectionName = row.getAttribute('data-section');
        const sectionId = row.getAttribute('data-section-id');
        console.log(`📍 Drop target: GROUP header "${sectionName}" (ID: ${sectionId})`);
    } else {
        const targetIndex = parseInt(row.getAttribute('data-index'));
        const targetPose = targetIndex >= 0 && targetIndex < editingFlow.asanas.length ? 
            editingFlow.asanas[targetIndex] : null;
        const targetSectionId = row.getAttribute('data-section-id');
        
        console.log(`📍 Drop target: POSE at index ${targetIndex}`);
        if (targetPose) {
            console.log(`   Pose name: "${targetPose.name}"`);
        }
        console.log(`   In group: ${targetSectionId ? 'Yes - ' + targetSectionId : 'No (ungrouped)'}`);
        
        if (targetSectionId) {
            const section = editingFlow.getSectionById(targetSectionId);
            if (section) {
                console.log(`   Group name: "${section.name}"`);
            }
        }
    }
    
    // If the source is a section header, handle section reordering
    if (dragSource.isSectionHeader) {
        handleSectionReordering(e, row);
        return;
    }
    
    // For regular pose drops on section headers, treat it as dropping at the first position in that section
    if (row.classList.contains('section-header')) {
        const sectionId = row.getAttribute('data-section-id');
        if (sectionId) {
            // Create a special row to handle dropping at the first position of a group
            const specialFirstPositionRow = document.createElement('tr');
            specialFirstPositionRow.setAttribute('data-special-drop', 'true');
            specialFirstPositionRow.setAttribute('data-first-position-drop', 'true');
            specialFirstPositionRow.setAttribute('data-section-id', sectionId);
            
            // Find the section to determine the first position
            const section = editingFlow.getSectionById(sectionId);
            const sectionRows = Array.from(document.querySelectorAll(`tr[data-section-id="${sectionId}"]:not(.section-header)`));
            
            if (sectionRows.length > 0) {
                // Get the first pose in this section - we always want to place at the beginning of the section
                const firstRow = sectionRows[0];
                const firstIndex = parseInt(firstRow.getAttribute('data-index'));
                
                // Set this as the target index for the special row
                specialFirstPositionRow.setAttribute('data-index', firstIndex);
                console.log(`Setting first position drop target to index ${firstIndex} in section ${sectionId}`);
                
                // Use our special row instead of the actual first row
                row = specialFirstPositionRow;
            } else {
                console.log('Cannot drop on an empty section header');
                return;
            }
        } else {
            console.log('Cannot drop on a section header without ID');
            return;
        }
    }
    
    // Get the section IDs for source and target rows
    const sourceSectionId = dragSource.sectionId;
    const targetSectionId = row.getAttribute('data-section-id') || null; // Ensure null for ungrouped
    
    // Now allow dropping between different sections
    const movingBetweenSections = sourceSectionId !== targetSectionId;
    
    // Special logging for moving to/from sections
    if (movingBetweenSections) {
        if (sourceSectionId && !targetSectionId) {
            console.log('Moving pose from group to ungrouped area', 
                `from group ${sourceSectionId}`);
        } else if (!sourceSectionId && targetSectionId) {
            console.log('Moving pose from ungrouped area to group', 
                `to group ${targetSectionId}`);
        } else {
            console.log('Moving pose between different groups', 
                sourceSectionId ? `from group ${sourceSectionId}` : 'from ungrouped', 
                targetSectionId ? `to group ${targetSectionId}` : 'to ungrouped');
        }
    }
    
    // Get source and target indices
    const sourceIndex = parseInt(dragSource.getAttribute('data-index'));
    const targetIndex = parseInt(row.getAttribute('data-index'));
    
    if (isNaN(sourceIndex) || isNaN(targetIndex) || sourceIndex === targetIndex) {
        console.log('⛔ Error: Invalid indices or source and target are the same');
        return;
    }
    
    console.log('------ POSE MOVEMENT ------');
    console.log(`Initial state: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}, sourceSectionId=${sourceSectionId}, targetSectionId=${targetSectionId}`);
    
    // Get source pose details
    const sourcePose = editingFlow.asanas[sourceIndex];
    if (sourcePose) {
        console.log(`🔄 Moving POSE: "${sourcePose.name}" from index ${sourceIndex} to ${targetIndex}`);
        
        // Log source group info
        const sourceGroup = sourceSectionId ? 
            editingFlow.getSectionById(sourceSectionId) : null;
        if (sourceGroup) {
            console.log(`   From group: "${sourceGroup.name}" (ID: ${sourceSectionId})`);
        } else {
            console.log('   From: Ungrouped poses');
        }
        
        // Log target group info
        const targetGroup = targetSectionId ? 
            editingFlow.getSectionById(targetSectionId) : null;
        if (targetGroup) {
            console.log(`   To group: "${targetGroup.name}" (ID: ${targetSectionId})`);
        } else {
            console.log('   To: Ungrouped poses');
        }
        
        // Log if this is cross-group movement
        if (sourceSectionId !== targetSectionId) {
            console.log('   ⚠️ Moving between different groups');
        }
    }
    
    try {
        console.log(`Moving asana index ${sourceIndex} to ${targetIndex}`);
        console.log('Current editingFlow.asanas before any splice:', JSON.parse(JSON.stringify(editingFlow.asanas)));
        console.log('Current editingFlow.sections before any splice:', JSON.parse(JSON.stringify(editingFlow.sections)));
        
        // Check if this is a special first position drop onto a section header
        const isFirstPositionDrop = row.hasAttribute('data-first-position-drop');
        
        // For our improved implementation, we want to ensure the pose is placed EXACTLY where it was dropped
        // Simplify the logic for determining the target position
        
        // Start with the exact target index from the drop location
        let adjustedTargetIndex = targetIndex;
        
        // Adjust target index only if we're moving downward
        // If the source index is before the target, we need to account for the removed item
        if (sourceIndex < targetIndex && !isFirstPositionDrop) {
            adjustedTargetIndex--;
            console.log(`Adjusted downward drop target: ${targetIndex} -> ${adjustedTargetIndex}`);
        }
        
        // Special case for first position drops within a section
        if (isFirstPositionDrop) {
            console.log(`Special handling for first position drop into section ${targetSectionId}`);
            // Use the exact first position index for the section
            adjustedTargetIndex = targetIndex;
        }
        
        console.log(`Final target position: ${adjustedTargetIndex}`);
        
        // Extra validation to ensure target index is in valid range
        if (adjustedTargetIndex < 0) {
            console.log(`Correcting negative target index to 0`);
            adjustedTargetIndex = 0;
        } else if (adjustedTargetIndex > editingFlow.asanas.length - 1 && editingFlow.asanas.length > 0) {
            // If dropping at end, place at the end (after removing source)
            // But only for non-empty arrays
            const lastValidIndex = sourceIndex < editingFlow.asanas.length - 1 ? 
                                   editingFlow.asanas.length - 1 : 
                                   editingFlow.asanas.length - 2;
            console.log(`Correcting out-of-bounds target index to ${lastValidIndex}`);
            adjustedTargetIndex = Math.max(0, lastValidIndex);
        }
        
        console.log(`Calculated adjusted target index: ${adjustedTargetIndex}`);
        
        // First, remove the pose from its current position (this modifies the asanas array)
        console.log(`Splicing asana from sourceIndex: ${sourceIndex}`);
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        console.log('editingFlow.asanas after removing source:', JSON.parse(JSON.stringify(editingFlow.asanas)));
        
        // Then insert it at the adjusted target position (this modifies the asanas array again)
        console.log(`Splicing asana to adjustedTargetIndex: ${adjustedTargetIndex}`);
        editingFlow.asanas.splice(adjustedTargetIndex, 0, movedAsana);
        console.log('editingFlow.asanas after inserting at target:', JSON.parse(JSON.stringify(editingFlow.asanas)));
        
        // Now that the asanas array is in its final state, update all section indices
        // This is the key fix - we update sections AFTER moving the asana
        console.log(`AFTER MOVE: asana moved from index ${sourceIndex} to final index ${adjustedTargetIndex}`);
        
        // Set the last moved pose index for highlighting
        lastMovedPoseIndex = adjustedTargetIndex;
        
        // Completely rebuild the section memberships based on the final state of the asanas array
        // This ensures all sections correctly reference poses at their new positions
        
        console.log('------ REBUILDING SECTION MEMBERSHIPS ------');
        console.log('Initial sections before update:', JSON.parse(JSON.stringify(editingFlow.sections)));
        
        // FIXED: Simple and robust section membership update
        // Instead of complex index mapping, we use a direct approach:
        // 1. Remove the moved pose from its original section (if any)
        // 2. Add the moved pose to its new section (if any) 
        // 3. Update all other poses' indices due to the array shift
        
        console.log('Updating section memberships after pose move...');
        
        // Step 1: Remove the moved pose from its original section
        if (sourceSectionId) {
            const sourceSection = editingFlow.getSectionById(sourceSectionId);
            if (sourceSection) {
                console.log(`Section ${sourceSectionId} asanaIds BEFORE filtering ${sourceIndex}: ${JSON.stringify(sourceSection.asanaIds)}`);
                sourceSection.asanaIds = sourceSection.asanaIds.filter(id => id !== sourceIndex);
                console.log(`Removed pose (original index ${sourceIndex}) from source section ${sourceSectionId}. New asanaIds: ${JSON.stringify(sourceSection.asanaIds)}`);
            }
        }
        
        // Step 2: Update all section indices due to the removal and insertion
        console.log('Remapping indices in all sections...');
        editingFlow.sections.forEach(section => {
            const originalIds = [...section.asanaIds];
            section.asanaIds = section.asanaIds.map(id => {
                let newId = id;
                // First adjust for the removal of sourceIndex
                if (id > sourceIndex) {
                    newId--;
                }
                // Then adjust for the insertion at adjustedTargetIndex
                if (newId >= adjustedTargetIndex) { // Note: use newId here for the condition
                    newId++;
                }
                if (id !== newId) {
                    console.log(`Section ${section.id}: Mapped index ${id} -> ${newId} (sourceIndex=${sourceIndex}, adjustedTargetIndex=${adjustedTargetIndex})`);
                }
                return newId;
            });
            if (JSON.stringify(originalIds) !== JSON.stringify(section.asanaIds)) {
                 console.log(`Section ${section.id} asanaIds AFTER remapping: ${JSON.stringify(section.asanaIds)} (was: ${JSON.stringify(originalIds)})`);
            }
        });
        
        // Step 3: Add the moved pose to its new section (if any)
        if (targetSectionId) {
            const targetSection = editingFlow.getSectionById(targetSectionId);
            if (targetSection) {
                console.log(`Section ${targetSectionId} asanaIds BEFORE adding ${adjustedTargetIndex}: ${JSON.stringify(targetSection.asanaIds)}`);
                if (!targetSection.asanaIds.includes(adjustedTargetIndex)) { // Avoid duplicates if already handled by remapping
                    targetSection.asanaIds.push(adjustedTargetIndex);
                }
                // Keep the section's poses in index order for consistency
                targetSection.asanaIds.sort((a, b) => a - b);
                console.log(`Added pose to target section ${targetSectionId} at new index ${adjustedTargetIndex}. New asanaIds: ${JSON.stringify(targetSection.asanaIds)}`);
            }
        }
        
        // Log updated section contents for verification
        console.log('Final sections after update:');
        editingFlow.sections.forEach(section => {
            console.log(`  Section ${section.id} ("${section.name}") updated asana IDs: ${section.asanaIds.join(', ')}`);
        });
        
        console.log('------ SECTION MEMBERSHIPS UPDATED ------');
        console.log('Final editingFlow.asanas before rebuild:', JSON.parse(JSON.stringify(editingFlow.asanas)));
        console.log('Final editingFlow.sections before rebuild:', JSON.parse(JSON.stringify(editingFlow.sections)));

        // Fully rebuild the table view with all the new indices and section memberships
        rebuildFlowTable();

        // Just update the positions in the card view without rebuilding it
        updateCardIndices();
        
        // Ensure draggable attributes are set again
        setTimeout(updateRowDragAttributes, 0);
        
        // Auto-save flow after every drag and drop change
        autoSaveFlow();
        
        // Log completion status
        console.log('✅ Pose movement completed successfully');
        
        // Log the updated section contents if moving between sections
        if (movingBetweenSections) {
            if (sourceSectionId) {
                const sourceSection = editingFlow.getSectionById(sourceSectionId);
                if (sourceSection) {
                    console.log(`Source group "${sourceSection.name}" after move:`);
                    console.log(`  Contains ${sourceSection.asanaIds.length} poses`);
                    sourceSection.asanaIds.forEach(index => {
                        const pose = editingFlow.asanas[index];
                        if (pose) {
                            console.log(`  - "${pose.name}" (Index: ${index})`);
                        }
                    });
                }
            }
            
            if (targetSectionId) {
                const targetSection = editingFlow.getSectionById(targetSectionId);
                if (targetSection) {
                    console.log(`Target group "${targetSection.name}" after move:`);
                    console.log(`  Contains ${targetSection.asanaIds.length} poses`);
                    targetSection.asanaIds.forEach(index => {
                        const pose = editingFlow.asanas[index];
                        if (pose) {
                            console.log(`  - "${pose.name}" (Index: ${index})`);
                        }
                    });
                }
            }
        }
        
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
        
        // Print the entire table data to console after drop
        console.log('------ TABLE AFTER DROP ------');
        console.log('Total poses:', editingFlow.asanas.length);
        
        // Log all poses with their indices
        console.log('POSES:');
        editingFlow.asanas.forEach((pose, index) => {
            // Find which section this pose belongs to
            const sectionInfo = editingFlow.sections.find(section => 
                section.asanaIds.includes(index)
            );
            
            const sectionName = sectionInfo ? 
                `"${sectionInfo.name}" (ID: ${sectionInfo.id})` : 
                'Ungrouped';
                
            console.log(`  ${index + 1}. "${pose.name}" - Group: ${sectionName}`);
        });
        
        // Log all groups with their contents
        console.log('GROUPS:');
        editingFlow.sections.forEach((section, idx) => {
            console.log(`  ${idx + 1}. "${section.name}" (ID: ${section.id})`);
            console.log(`     Contains ${section.asanaIds.length} poses:`);
            
            section.asanaIds.forEach(asanaIndex => {
                const pose = editingFlow.asanas[asanaIndex];
                if (pose) {
                    console.log(`       - ${asanaIndex + 1}. "${pose.name}"`);
                }
            });
        });
    } catch (error) {
        console.error('Error during drop:', error);
    }
}

// Handle reordering of an entire section
function handleSectionReordering(e, targetRow) {
    console.log('------ SECTION REORDERING ------');
    
    if (!dragSource || !dragSource.isSectionHeader) {
        console.error('⛔ Error: Not a valid section drag operation');
        return;
    }
    
    const sourceSectionId = dragSource.sectionHeaderId;
    if (!sourceSectionId) {
        console.error('⛔ Error: Source section ID not found');
        return;
    }
    
    // Get source section details
    const sourceSection = editingFlow.getSectionById(sourceSectionId);
    if (!sourceSection) {
        console.error('⛔ Error: Source section not found');
        return;
    }
    
    console.log(`🔄 Moving GROUP: "${sourceSection.name}" (ID: ${sourceSectionId})`);
    console.log(`   Contains ${sourceSection.asanaIds.length} poses`);
    
    // Log the poses in this section
    if (sourceSection.asanaIds.length > 0) {
        console.log('   Poses in this group:');
        sourceSection.asanaIds.forEach(asanaId => {
            if (asanaId >= 0 && asanaId < editingFlow.asanas.length) {
                console.log(`     - "${editingFlow.asanas[asanaId].name}" (Index: ${asanaId})`);
            }
        });
    }
    
    // Determine target position
    let targetPosition = 'Unknown';
    let targetSectionId = null;
    
    if (targetRow.classList.contains('section-header')) {
        targetSectionId = targetRow.getAttribute('data-section-id');
        const targetSectionName = targetRow.getAttribute('data-section');
        targetPosition = `before group "${targetSectionName}" (ID: ${targetSectionId})`;
    } else {
        targetSectionId = targetRow.getAttribute('data-section-id');
        if (targetSectionId) {
            const targetSection = editingFlow.getSectionById(targetSectionId);
            if (targetSection) {
                targetPosition = `after group "${targetSection.name}" (ID: ${targetSectionId})`;
            }
        } else {
            const targetIndex = parseInt(targetRow.getAttribute('data-index'));
            const targetPose = targetIndex >= 0 && targetIndex < editingFlow.asanas.length ? 
                editingFlow.asanas[targetIndex] : null;
            if (targetPose) {
                targetPosition = `at ungrouped pose "${targetPose.name}" (Index: ${targetIndex})`;
            } else {
                targetPosition = `at row ${targetRow.rowIndex}`;
            }
        }
    }
    
    console.log(`📍 Target position: ${targetPosition}`);
    
    // FIXED: Use the improved reorderSection method for all cases
    // No need for special handling - the reorderSection method now handles all scenarios robustly
    const success = editingFlow.reorderSection(sourceSectionId, targetRow);
    
    if (success) {
        console.log('✅ Section reordering successful');
        
        // Log the new section order
        console.log('New section order:');
        editingFlow.sections.forEach((section, index) => {
            console.log(`  ${index + 1}. "${section.name}" (ID: ${section.id}) - ${section.asanaIds.length} poses`);
        });
        
        // Fully rebuild the table with the new section order
        rebuildFlowTable();
        
        // Update the card view without rebuilding
        updateCardIndices();
        
        // Ensure draggable attributes are set again
        setTimeout(updateRowDragAttributes, 0);
        
        // Show notification
        showToastNotification('Group reordered successfully');
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
        
        return true;
    }
    
    console.error('⛔ Failed to reorder section');
    return false;
}

function handleTableDragEnd(e) {
    // Remove all drag styling
    document.querySelectorAll('#flowTable tr').forEach(row => {
        row.classList.remove('dragging', 'drop-target');
    });

    // Clear the drag source
    console.log('Drag operation ended');
    if (dragSource && dragSource.element) {
        // Remove dragging class from the element
        dragSource.classList.remove('dragging');
    }
    // Reset dragSource
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
    
    // Add a floating number indicator
    const cardIndex = parseInt(card.getAttribute('data-index'));
    const numberElement = card.querySelector('.flow-card-number');
    const displayNumber = numberElement ? numberElement.textContent.trim() : (cardIndex + 1).toString();
    
    // Log the pose information to console
    console.log(`Dragging card pose number: ${displayNumber} (index: ${cardIndex})`);
    if (cardIndex >= 0 && cardIndex < editingFlow.asanas.length) {
        const pose = editingFlow.asanas[cardIndex];
        console.log(`Pose name: ${pose.name}`);
        console.log(`Pose duration: ${pose.duration} seconds`);
        if (pose.chakra) console.log(`Pose chakra: ${pose.chakra}`);
        if (pose.side) console.log(`Pose side: ${pose.side}`);
    }
    
    // Create a floating indicator showing the pose number being dragged
    const indicator = document.createElement('div');
    indicator.className = 'pose-drag-indicator';
    indicator.textContent = displayNumber;
    indicator.style.position = 'fixed';
    indicator.style.backgroundColor = '#ff8c00';
    indicator.style.color = 'white';
    indicator.style.padding = '8px 12px';
    indicator.style.borderRadius = '50%';
    indicator.style.fontWeight = 'bold';
    indicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    indicator.style.zIndex = '10000';
    indicator.style.fontSize = '18px';
    indicator.style.pointerEvents = 'none';
    indicator.id = 'pose-drag-indicator';
    document.body.appendChild(indicator);
    
    // Position it near the cursor
    const updateIndicatorPosition = (e) => {
        indicator.style.left = (e.clientX + 15) + 'px';
        indicator.style.top = (e.clientY + 15) + 'px';
    };
    
    // Initial position
    updateIndicatorPosition(e);
    
    // Update position during drag
    document.addEventListener('dragover', updateIndicatorPosition);
    
    // Remove indicator when drag ends
    document.addEventListener('dragend', function removeIndicator() {
        if (document.getElementById('pose-drag-indicator')) {
            document.body.removeChild(indicator);
        }
        document.removeEventListener('dragover', updateIndicatorPosition);
        document.removeEventListener('dragend', removeIndicator);
    }, { once: true });

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

        // Create a map to track how indices will change after the move
        let indexMap = new Map();
        
        // Update all the sections first BEFORE actually moving the asana
        // This ensures we're working with the original indices while updating
        
        // Get the section IDs for source and target rows
        const sourceSectionId = editingFlow.sections.find(section => 
            section.asanaIds.includes(sourceIndex))?.id;
        
        // Find which section the target index belongs to
        const targetSectionId = editingFlow.sections.find(section => 
            section.asanaIds.includes(targetIndex))?.id;
        
        // Check if we're moving between different sections
        const movingBetweenSections = sourceSectionId !== targetSectionId;
        
        // Process sections first to build the index mapping
        editingFlow.sections.forEach(section => {
            // Create a copy of the section's asana IDs for reference
            const originalIds = [...section.asanaIds];
            
            // Track which ids we need to update
            let updatedIds = [];
            
            for (const id of originalIds) {
                // If this is the source index being moved
                if (id === sourceIndex) {
                    // Only keep if this is the target section
                    if (section.id === targetSectionId) {
                        // It will map to the target index
                        updatedIds.push(targetIndex);
                    }
                    // Otherwise remove it from the source section
                }
                // Handle other indices that might shift
                else {
                    let newIndex = id;
                    
                    // If moving an asana down in the array
                    if (sourceIndex < targetIndex) {
                        // Shift indices that are between source and target (inclusive) down by 1
                        if (id > sourceIndex && id <= targetIndex) {
                            newIndex = id - 1;
                        }
                    } 
                    // If moving an asana up in the array
                    else {
                        // Shift indices that are between target and source (inclusive) up by 1
                        if (id >= targetIndex && id < sourceIndex) {
                            newIndex = id + 1;
                        }
                    }
                    
                    updatedIds.push(newIndex);
                    // Store the mapping for later reference
                    indexMap.set(id, newIndex);
                }
            }
            
            // If this is the target section and we're moving from outside this section
            if (section.id === targetSectionId && (!sourceSectionId || sourceSectionId !== targetSectionId)) {
                // Check if this is a first position drop
                const isFirstPositionDrop = row && row.hasAttribute('data-first-position-drop');
                
                // Add the pose at the target index if it's not already there
                if (!updatedIds.includes(targetIndex)) {
                    if (isFirstPositionDrop) {
                        // For first position drops, always put the pose at the beginning of the section
                        console.log(`First position drop - adding at beginning of section ${section.id}`);
                        updatedIds.unshift(targetIndex);
                    } else {
                        // For regular drops, insert at the target position indicated by the drag number
                        // This ensures that a pose dragged to position #3 takes that exact position
                        let insertPosition = 0;
                        while (insertPosition < updatedIds.length && updatedIds[insertPosition] < targetIndex) {
                            insertPosition++;
                        }
                        updatedIds.splice(insertPosition, 0, targetIndex);
                        console.log(`Inserting pose at position ${insertPosition} in group`);
                    }
                }
            }
            
            // Don't sort - we've already carefully positioned items
            // updatedIds.sort((a, b) => a - b);
            
            // Store updated IDs for this section
            section.asanaIds = updatedIds;
        });
        
        // Check if this is a special first position drop onto a section header
        const isFirstPositionDrop = row.hasAttribute('data-first-position-drop');
        
        // Now move the actual pose in the asanas array
        // When moving down, we need to adjust the target index since removing the source element shifts everything
        let adjustedTargetIndex = targetIndex;
        if (sourceIndex < targetIndex && !isFirstPositionDrop) {
            adjustedTargetIndex = targetIndex - 1;
        }
        
        // First, remove the pose from its current position
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        
        // For special first position drops, always use the exact target index regardless of source index
        if (isFirstPositionDrop) {
            console.log(`Special handling for first position drop into section ${targetSectionId}`);
            // We intentionally don't adjust the target index for first position drops
            // to ensure it's placed at exactly that position
            adjustedTargetIndex = targetIndex;
        }
        
        // When a pose is dragged onto a number, it should take the exact position indicated by that number
        // This will push the pose currently at that position (and all following poses) down by one
        editingFlow.asanas.splice(adjustedTargetIndex, 0, movedAsana);

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

        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
        
        // Print the entire table data to console after card drop
        console.log('------ CARD VIEW AFTER DROP ------');
        console.log('Total poses:', editingFlow.asanas.length);
        
        // Log all poses with their indices
        console.log('POSES:');
        editingFlow.asanas.forEach((pose, index) => {
            // Find which section this pose belongs to
            const sectionInfo = editingFlow.sections.find(section => 
                section.asanaIds.includes(index)
            );
            
            const sectionName = sectionInfo ? 
                `"${sectionInfo.name}" (ID: ${sectionInfo.id})` : 
                'Ungrouped';
                
            console.log(`  ${index + 1}. "${pose.name}" - Group: ${sectionName}`);
        });
        
        // Log all groups with their contents
        console.log('GROUPS:');
        editingFlow.sections.forEach((section, idx) => {
            console.log(`  ${idx + 1}. "${section.name}" (ID: ${section.id})`);
            console.log(`     Contains ${section.asanaIds.length} poses:`);
            
            section.asanaIds.forEach(asanaIndex => {
                const pose = editingFlow.asanas[asanaIndex];
                if (pose) {
                    console.log(`       - ${asanaIndex + 1}. "${pose.name}"`);
                }
            });
        });
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
    // Use optimized version if available, fallback to original
    if (typeof rebuildFlowTableOptimized === 'function') {
        rebuildFlowTableOptimized();
    } else {
        rebuildFlowTableLegacy();
    }
}

function rebuildFlowTableOptimized() {
    // Only rebuild the active view for better performance
    if (currentViewMode === 'table') {
        rebuildTableViewOptimized();
    } else {
        rebuildCardViewOptimized();
    }
    
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

    // Defer heavy operations to avoid blocking UI
    requestAnimationFrame(() => {
        setupDragAndDrop();
        updateDragDropHandlers();
        updateFlowDuration();
    });
}

function rebuildFlowTableLegacy() {
    // Original implementation
    rebuildTableView();
    rebuildCardView();
    
    setTimeout(setupDragAndDrop, 10);

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

    updateDragDropHandlers();
    updateFlowDuration();
}

function rebuildTableViewOptimized() {
    const table = document.getElementById('flowTable');
    if (!table) return;

    // Use more efficient table clearing
    const tbody = table.tBodies[0];
    if (tbody) {
        tbody.innerHTML = '';
    } else {
        // Fallback to row deletion if no tbody
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
    }

    // Load all poses regardless of size, but use optimized rendering for large flows

    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    buildTableRowsOptimized(fragment);
    
    // Add all rows at once
    if (tbody) {
        tbody.appendChild(fragment);
    } else {
        table.appendChild(fragment);
    }
}

function buildTableRowsOptimized(fragment) {
    if (!editingFlow.asanas || editingFlow.asanas.length === 0) {
        return;
    }

    // Pre-calculate section data for better performance
    const sectionData = prepareSectionData();
    
    // Build rows based on calculated data
    let sequentialPosition = 0;
    const processedSections = new Set();
    
    sectionData.allIndices.forEach(index => {
        if (sectionData.unsectionedAsanas.has(index)) {
            // Add unsectioned asana
            sequentialPosition++;
            const displayNumber = tableInDescendingOrder ? 
                editingFlow.asanas.length - sequentialPosition + 1 : sequentialPosition;
            
            const row = createAsanaRowElement(editingFlow.asanas[index], index, '', '', displayNumber);
            fragment.appendChild(row);
        } else {
            // Add section if this is the first asana in the section
            const sectionInfo = sectionData.sectionPositions.find(sp => 
                sp.lowestIndex === index && !processedSections.has(sp.section.id)
            );
            
            if (sectionInfo) {
                processedSections.add(sectionInfo.section.id);
                
                // Add section header
                const headerRow = createSectionHeaderRow(sectionInfo);
                fragment.appendChild(headerRow);
                
                // Add all asanas in this section
                sectionInfo.asanas.forEach(({asana, index: asanaIndex}) => {
                    sequentialPosition++;
                    const displayNumber = tableInDescendingOrder ? 
                        editingFlow.asanas.length - sequentialPosition + 1 : sequentialPosition;
                    
                    const row = createAsanaRowElement(asana, asanaIndex, sectionInfo.section.name, 
                        sectionInfo.section.id, displayNumber);
                    row.classList.add(`section-color-${sectionInfo.sectionIndex % 3}`);
                    
                    if (sectionInfo.section.collapsed) {
                        row.setAttribute('data-hidden', 'true');
                    }
                    
                    fragment.appendChild(row);
                });
            }
        }
    });
}

function prepareSectionData() {
    const unsectionedAsanas = new Set();
    for (let i = 0; i < editingFlow.asanas.length; i++) {
        unsectionedAsanas.add(i);
    }
    
    const sectionPositions = [];
    
    editingFlow.sections.forEach((section, sectionIndex) => {
        const asanasInSection = editingFlow.getAsanasInSection(section.id)
            .sort((a, b) => a.index - b.index);
            
        if (asanasInSection.length === 0) return;
        
        const lowestIndex = Math.min(...asanasInSection.map(a => a.index));
        
        sectionPositions.push({
            section,
            lowestIndex,
            sectionIndex,
            asanas: tableInDescendingOrder ? 
                asanasInSection.sort((a, b) => b.index - a.index) :
                asanasInSection.sort((a, b) => a.index - b.index)
        });
        
        asanasInSection.forEach(({index}) => {
            unsectionedAsanas.delete(index);
        });
    });
    
    // Sort sections by position
    sectionPositions.sort((a, b) => tableInDescendingOrder ? 
        b.lowestIndex - a.lowestIndex : a.lowestIndex - b.lowestIndex);
    
    const allIndices = [...Array(editingFlow.asanas.length).keys()];
    if (tableInDescendingOrder) {
        allIndices.reverse();
    }
    
    return { unsectionedAsanas, sectionPositions, allIndices };
}


function createAsanaRowElement(asana, index, sectionName, sectionId, displayNumber) {
    const row = document.createElement('tr');
    row.setAttribute('draggable', 'true');
    row.setAttribute('data-index', index);
    
    if (sectionName && sectionId) {
        row.setAttribute('data-section', sectionName);
        row.setAttribute('data-section-id', sectionId);
    }
    
    if (lastMovedPoseIndex !== null && lastMovedPoseIndex === index) {
        row.classList.add('last-moved-pose');
    }
    
    const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
    
    row.innerHTML = createAsanaRowHTML(asana, index, sectionName, sectionId, displayNumber, imgTransform);
    
    return row;
}

function createSectionHeaderRow(sectionInfo) {
    const { section, sectionIndex, asanas } = sectionInfo;
    const headerRow = document.createElement('tr');
    headerRow.className = 'section-header';
    headerRow.setAttribute('data-section', section.name);
    headerRow.setAttribute('data-section-id', section.id);
    headerRow.setAttribute('draggable', 'true');
    
    const colorClass = `section-color-${sectionIndex % 3}`;
    headerRow.classList.add(colorClass);
    
    if (section.collapsed) {
        headerRow.classList.add('collapsed');
    }
    
    const allSelected = asanas.every(asanaInfo => asanaInfo.asana.selected);
    const sectionDuration = asanas.reduce((total, {asana}) => total + (asana.duration || 7), 0);
    const sectionDurationDisplay = displayFlowDuration(sectionDuration);
    
    headerRow.innerHTML = `
        <td colspan="7" class="section-header-content">
            <div class="section-header-flex">
                <div class="section-checkbox">
                    <input type="checkbox" class="section-select" 
                       data-section="${section.name}" 
                       data-section-id="${section.id}" 
                       ${allSelected ? 'checked' : ''}
                       onchange="toggleSectionSelection(this)">
                </div>
                <div class="section-toggle" onclick="toggleSectionCollapse('${section.id}')" title="Collapse/Expand group">
                    <div class="section-toggle-icon">${section.collapsed ? '▶' : '▼'}</div>
                </div>
                <div class="section-name" onclick="toggleSectionCollapse('${section.id}')" style="cursor: pointer;">
                    <span>${section.name}</span>
                    <span class="section-count-duration">${asanas.length} pose${asanas.length !== 1 ? 's' : ''} - ${sectionDurationDisplay}</span>
                </div>
                <div class="section-side-control">
                    <select class="section-side-select" data-section-id="${section.id}" onchange="changeSectionSide(this)" title="Change side for all poses in this group">
                        <option value="--" selected>--</option>
                        <option value="Left">Left</option>
                        <option value="Right">Right</option>
                        <option value="Front">Front</option>
                        <option value="Back">Back</option>
                    </select>
                </div>
                <div class="section-remove">
                    <button class="table-btn remove-btn" onclick="deleteSection('${section.id}')" title="Delete group">⛓️‍💥</button>
                </div>
            </div>
        </td>
    `;
    
    return headerRow;
}

function createAsanaRowHTML(asana, index, sectionName, sectionId, displayNumber, imgTransform) {
    return `
        <td title="Drag to reorder">${displayNumber}</td>
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
            <button class="table-btn swap-btn" onclick="showSwapPoseModal(${index})" title="Swap for another pose">⇆</button>
        </td>
        <td>
            <button class="table-btn remove-btn" onclick="removePose(this)">×</button>
        </td>
    `;
}

function rebuildCardViewOptimized() {
    const cardsContainer = document.querySelector('.flow-cards');
    if (!cardsContainer) return;

    // Load all poses regardless of size, using optimized rendering

    // Use DocumentFragment for batch operations
    const fragment = document.createDocumentFragment();
    
    // Clear existing cards
    cardsContainer.innerHTML = '';

    if (editingFlow.asanas.length === 0) {
        cardsContainer.innerHTML = '<div class="empty-message"><p>No poses added yet.</p><p>Select poses from above to build your flow.</p></div>';
        return;
    }

    // Build cards using same section logic as table
    const sectionData = prepareSectionData();
    buildCardElementsOptimized(fragment, sectionData);
    
    cardsContainer.appendChild(fragment);
}

function buildCardElementsOptimized(fragment, sectionData) {
    let sequentialPosition = 0;
    const processedSections = new Set();
    
    sectionData.allIndices.forEach(index => {
        if (sectionData.unsectionedAsanas.has(index)) {
            sequentialPosition++;
            const displayNumber = tableInDescendingOrder ? 
                editingFlow.asanas.length - sequentialPosition + 1 : sequentialPosition;
            
            const card = createAsanaCardElement(editingFlow.asanas[index], index, displayNumber);
            fragment.appendChild(card);
        } else {
            const sectionInfo = sectionData.sectionPositions.find(sp => 
                sp.lowestIndex === index && !processedSections.has(sp.section.id)
            );
            
            if (sectionInfo) {
                processedSections.add(sectionInfo.section.id);
                
                // Add section header card
                const sectionCard = createSectionCardElement(sectionInfo);
                fragment.appendChild(sectionCard);
                
                // Add asana cards for this section
                sectionInfo.asanas.forEach(({asana, index: asanaIndex}) => {
                    sequentialPosition++;
                    const displayNumber = tableInDescendingOrder ? 
                        editingFlow.asanas.length - sequentialPosition + 1 : sequentialPosition;
                    
                    const card = createAsanaCardElement(asana, asanaIndex, displayNumber);
                    card.classList.add(`section-color-${sectionInfo.sectionIndex % 3}`);
                    
                    if (sectionInfo.section.collapsed) {
                        card.style.display = 'none';
                    }
                    
                    fragment.appendChild(card);
                });
            }
        }
    });
}

function createAsanaCardElement(asana, index, displayNumber) {
    const card = document.createElement('div');
    card.className = 'asana-card';
    card.setAttribute('data-index', index);
    card.setAttribute('draggable', 'true');
    
    if (lastMovedPoseIndex !== null && lastMovedPoseIndex === index) {
        card.classList.add('last-moved-pose');
    }
    
    const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
    
    card.innerHTML = `
        <div class="card-number">${displayNumber}</div>
        <div class="card-checkbox">
            <input type="checkbox" class="asana-select" data-index="${index}"
                   ${asana.selected ? 'checked' : ''}
                   onchange="toggleAsanaSelection(this)">
        </div>
        <div class="card-image">
            <img src="${asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`}" alt="${asana.name}" style="${imgTransform}"
                 onerror="this.onerror=null; this.src='images/webp/default-pose.webp';">
        </div>
        <div class="card-name">${typeof asana.getDisplayName === 'function' ?
                asana.getDisplayName(useSanskritNames) :
                (useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name)}</div>
        <div class="card-duration">
            <input type="number" value="${asana.duration || 3}" min="1" max="300" onchange="updateFlowDuration()"/>s
        </div>
        <div class="card-side">${createSideDropdown(asana.side)}</div>
        <div class="card-actions">
            <button class="table-btn swap-btn" onclick="showSwapPoseModal(${index})" title="Swap pose">⇆</button>
            <button class="table-btn remove-btn" onclick="removePose(this)">×</button>
        </div>
    `;
    
    return card;
}

function createSectionCardElement(sectionInfo) {
    const { section, sectionIndex, asanas } = sectionInfo;
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card';
    sectionCard.setAttribute('data-section-id', section.id);
    
    const allSelected = asanas.every(asanaInfo => asanaInfo.asana.selected);
    const sectionDuration = asanas.reduce((total, {asana}) => total + (asana.duration || 7), 0);
    const sectionDurationDisplay = displayFlowDuration(sectionDuration);
    
    sectionCard.innerHTML = `
        <div class="section-card-header section-color-${sectionIndex % 3}">
            <input type="checkbox" class="section-select" 
                   data-section="${section.name}" 
                   data-section-id="${section.id}" 
                   ${allSelected ? 'checked' : ''}
                   onchange="toggleSectionSelection(this)">
            <span onclick="toggleSectionCollapse('${section.id}')" style="cursor: pointer;">
                ${section.collapsed ? '▶' : '▼'} ${section.name}
            </span>
            <span class="section-info">${asanas.length} poses - ${sectionDurationDisplay}</span>
            <button class="table-btn remove-btn" onclick="deleteSection('${section.id}')" title="Delete section">⛓️‍💥</button>
        </div>
    `;
    
    return sectionCard;
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
        // Get asanas in this section - use natural order here regardless of display order
        // This is just for determining section position
        const asanasInSection = editingFlow.getAsanasInSection(section.id)
            .sort((a, b) => a.index - b.index);
            
        if (asanasInSection.length === 0) return;
        
        // Find lowest index in the section to determine its position
        const lowestIndex = Math.min(...asanasInSection.map(a => a.index));
        
        // Store section with its position info
        sectionPositions.push({
            section,
            lowestIndex,
            sectionIndex,
            asanas: asanasInSection // Store the asanas in this section
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
    
    // Respect the current sort order to ensure unsectioned poses appear in the right order
    if (tableInDescendingOrder) {
        allAsanaIndices.reverse();
    }
    
    // Process each index in order, adding either individual asanas or entire sections
    let processedSections = new Set();
    // Track the sequential position to ensure consistent numbering across groups
    let sequentialPosition = 0;
    
    allAsanaIndices.forEach(index => {
        // If this is an unsectioned asana, add it
        if (unsectionedAsanas.has(index)) {
            const asana = editingFlow.asanas[index];
            if (!asana) return;
            
            // Increment the position counter
            sequentialPosition++;
            
            // Calculate appropriate row number based on sort order and sequential position
            let displayNumber;
            if (tableInDescendingOrder) {
                displayNumber = editingFlow.asanas.length - sequentialPosition + 1;
            } else {
                displayNumber = sequentialPosition;
            }
            
            // Pass the display number to addAsanaRow
            addAsanaRow(table, asana, index, '', '', displayNumber);
        } 
        // If this is the first asana in a section we haven't processed yet, add the entire section
        else {
            // Find which section contains this asana
            const sectionPosition = sectionPositions.find(sp => 
                sp.lowestIndex === index && !processedSections.has(sp.section.id)
            );
            
            if (sectionPosition) {
                const {section, sectionIndex, asanas: sectionAsanas} = sectionPosition;
                processedSections.add(section.id);
                
                // Add section header row
                const headerRow = table.insertRow(-1);
                headerRow.className = 'section-header';
                headerRow.setAttribute('data-section', section.name);
                headerRow.setAttribute('data-section-id', section.id);
                headerRow.setAttribute('draggable', 'true');
                
                // Add a section color class for consistent coloring
                const colorClass = `section-color-${sectionIndex % 3}`;
                headerRow.classList.add(colorClass);
                
                // Restore collapsed state from section data
                if (section.collapsed) {
                    headerRow.classList.add('collapsed');
                }
                
                // Get asanas in this section and sort them by their indices
                // Use the correct sort order based on tableInDescendingOrder
                const asanasInSection = editingFlow.getAsanasInSection(section.id)
                    .sort((a, b) => tableInDescendingOrder ? b.index - a.index : a.index - b.index);
                
                // Calculate if all poses in this section are selected
                const allSelected = asanasInSection.every(asanaInfo => asanaInfo.asana.selected);
                
                // Calculate total duration for this section
                const sectionDuration = asanasInSection.reduce((total, {asana}) => total + (asana.duration || 7), 0);
                const sectionDurationDisplay = displayFlowDuration(sectionDuration);
                
                // Create section header with checkbox and collapse/expand toggle
                headerRow.innerHTML = `
                    <td colspan="7" class="section-header-content">
                        <div class="section-header-flex">
                            <div class="section-checkbox">
                                <input type="checkbox" class="section-select" 
                                   data-section="${section.name}" 
                                   data-section-id="${section.id}" 
                                   ${allSelected ? 'checked' : ''}
                                   onchange="toggleSectionSelection(this)">
                            </div>
                            <div class="section-toggle" onclick="toggleSectionCollapse('${section.id}')" title="Collapse/Expand group">
                                <div class="section-toggle-icon">${section.collapsed ? '▶' : '▼'}</div>
                            </div>
                            <div class="section-name" onclick="toggleSectionCollapse('${section.id}')" style="cursor: pointer;">
                                <span>${section.name}</span>
                                <span class="section-count-duration">${asanasInSection.length} pose${asanasInSection.length !== 1 ? 's' : ''} - ${sectionDurationDisplay}</span>
                            </div>
                            <div class="section-side-control">
                                <select class="section-side-select" data-section-id="${section.id}" onchange="changeSectionSide(this)" title="Change side for all poses in this group">
                                    <option value="--" selected>--</option>
                                    <option value="Left">Left</option>
                                    <option value="Right">Right</option>
                                    <option value="Front">Front</option>
                                    <option value="Back">Back</option>
                                </select>
                            </div>
                            <div class="section-remove">
                                <button class="table-btn remove-btn" onclick="deleteSection('${section.id}')" title="Delete group">⛓️‍💥</button>
                            </div>
                        </div>
                    </td>
                `;
                
                // Add asana rows for this section
                asanasInSection.forEach(({asana, index}) => {
                    // Increment the position counter for each asana in the section
                    sequentialPosition++;
                    
                    // Calculate appropriate row number based on sort order and sequential position
                    let displayNumber;
                    if (tableInDescendingOrder) {
                        displayNumber = editingFlow.asanas.length - sequentialPosition + 1;
                    } else {
                        displayNumber = sequentialPosition;
                    }
                    
                    // Pass the display number to addAsanaRow
                    const row = addAsanaRow(table, asana, index, section.name, section.id, displayNumber);
                    // Add the same color class to ensure visual consistency
                    row.classList.add(colorClass);
                    
                    // Set the hidden attribute if the section is collapsed
                    if (headerRow.classList.contains('collapsed')) {
                        row.setAttribute('data-hidden', 'true');
                    } else {
                        row.setAttribute('data-hidden', 'false');
                    }
                });
            }
        }
    });
    
    // We're removing the "Create New Section" button at the bottom as requested
}

// Function to toggle the collapse/expand state of a section
function toggleSectionCollapse(sectionId) {
    // Find the section header
    const sectionHeader = document.querySelector(`tr.section-header[data-section-id="${sectionId}"]`);
    if (!sectionHeader) return;
    
    // Toggle the collapsed class on the header
    sectionHeader.classList.toggle('collapsed');
    
    // Get all rows in this section
    const sectionRows = document.querySelectorAll(`tr[data-section-id="${sectionId}"]:not(.section-header)`);
    
    // Toggle the hidden state for each row
    const isCollapsed = sectionHeader.classList.contains('collapsed');
    sectionRows.forEach(row => {
        row.setAttribute('data-hidden', isCollapsed);
    });
    
    // Update the toggle icon
    const toggleIcon = sectionHeader.querySelector('.section-toggle-icon');
    if (toggleIcon) {
        toggleIcon.textContent = isCollapsed ? '▶' : '▼';
    }
    
    // Save the collapsed state to the section data
    const section = editingFlow.sections.find(s => s.id === sectionId);
    if (section) {
        section.collapsed = isCollapsed;
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    }
}

// Helper function to add an asana row to the table
function addAsanaRow(table, asana, index, sectionName, sectionId, displayNumber) {
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
    
    // Add last-moved-pose class if this is the last moved pose
    if (lastMovedPoseIndex !== null && lastMovedPoseIndex === index) {
        row.classList.add('last-moved-pose');
    }
    
    // Use the provided display number if available, otherwise calculate based on index
    let rowNumber;
    if (displayNumber !== undefined) {
        rowNumber = displayNumber;
    } else if (tableInDescendingOrder) {
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
            <button class="table-btn swap-btn" onclick="showSwapPoseModal(${index})" title="Swap for another pose">⇆</button>
        </td>
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

    // First determine if poses are in sections to maintain consistent numbering with table view
    let unsectionedAsanas = new Set();
    for (let i = 0; i < editingFlow.asanas.length; i++) {
        unsectionedAsanas.add(i);
    }
    
    // Map of sections
    const sectionMap = {};
    
    // Identify which poses belong to sections
    editingFlow.sections.forEach(section => {
        const asanasInSection = editingFlow.getAsanasInSection(section.id);
        asanasInSection.forEach(({index}) => {
            unsectionedAsanas.delete(index);
            if (!sectionMap[section.id]) {
                sectionMap[section.id] = [];
            }
            sectionMap[section.id].push(index);
        });
    });
    
    // Create an array to hold poses in order as they would appear in the table
    let orderedPoses = [];
    
    // Add unsectioned poses first
    for (let i = 0; i < editingFlow.asanas.length; i++) {
        if (unsectionedAsanas.has(i)) {
            orderedPoses.push(i);
        }
    }
    
    // Add sectioned poses in order of their lowest index
    const sectionsByLowestIndex = [];
    Object.keys(sectionMap).forEach(sectionId => {
        const indices = sectionMap[sectionId];
        if (indices.length > 0) {
            const lowestIndex = Math.min(...indices);
            sectionsByLowestIndex.push({ 
                sectionId, 
                lowestIndex,
                indices
            });
        }
    });
    
    // Sort sections by their position in the flow
    if (tableInDescendingOrder) {
        sectionsByLowestIndex.sort((a, b) => b.lowestIndex - a.lowestIndex);
    } else {
        sectionsByLowestIndex.sort((a, b) => a.lowestIndex - b.lowestIndex);
    }
    
    // Add all sectioned poses in order
    sectionsByLowestIndex.forEach(section => {
        let sectionIndices = [...section.indices];
        // Always sort indices in the same direction as table view
        sectionIndices.sort((a, b) => tableInDescendingOrder ? b - a : a - b);
        sectionIndices.forEach(index => {
            orderedPoses.push(index);
        });
    });
    
    // Now rebuild cards in the determined order
    orderedPoses.forEach((index, position) => {
        const asana = editingFlow.asanas[index];
        if (!asana) return;

        // Determine card number based on position in the ordered list
        let cardNumber = position + 1;
        if (tableInDescendingOrder) {
            cardNumber = editingFlow.asanas.length - position;
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

        // Create all four side options consistently
        const frontOption = document.createElement('option');
        frontOption.value = "Front";
        frontOption.textContent = "Front";
        frontOption.selected = (asana.side === "Center" || asana.side === "Front");
        sideSelect.appendChild(frontOption);

        const backOption = document.createElement('option');
        backOption.value = "Back";
        backOption.textContent = "Back";
        backOption.selected = asana.side === "Back";
        sideSelect.appendChild(backOption);

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

        // Create swap button
        const swapBtn = document.createElement('button');
        swapBtn.className = 'swap-btn';
        swapBtn.textContent = '⇆';
        swapBtn.title = 'Swap for another pose';
        swapBtn.onclick = function(e) {
            e.stopPropagation(); // Prevent event bubbling
            showSwapPoseModal(index);
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
        card.appendChild(swapBtn); // Add the swap button directly to the card
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
// Debounced Sanskrit toggle to prevent rapid consecutive updates
let sanskritToggleTimeout = null;

function toggleSanskritNames(event) {
    console.log("Toggle Sanskrit Names called");
    
    // Clear any pending toggle updates
    if (sanskritToggleTimeout) {
        clearTimeout(sanskritToggleTimeout);
    }
    
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
    
    // Immediately sync all toggles to match the source toggle (visual feedback)
    const newState = sourceToggle ? sourceToggle.checked : false;
    if (globalToggle && sourceToggle) {
        globalToggle.checked = newState;
    }
    if (buildToggle && sourceToggle) {
        buildToggle.checked = newState;
    }
    if (flowToggle && sourceToggle) {
        flowToggle.checked = newState;
    }
    
    // Update the global state immediately
    useSanskritNames = newState;
    console.log("Sanskrit names toggled to:", useSanskritNames);
    
    // Save to localStorage immediately
    localStorage.setItem('useSanskritNames', useSanskritNames);
    
    // Immediately update flow screen names (highest priority for user experience)
    updateFlowScreenNames();
    
    // Show notification immediately
    const message = useSanskritNames ? 'Showing Sanskrit Names' : 'Showing English Names';
    showToastNotification(message);
    
    // Debounce the heavy UI updates
    sanskritToggleTimeout = setTimeout(() => {
        updateSanskritNamesOptimized();
        sanskritToggleTimeout = null;
    }, 150); // 150ms debounce
}

function updateSanskritNamesOptimized() {
    // Batch DOM updates using requestAnimationFrame for better performance
    requestAnimationFrame(() => {
        // Update table names efficiently
        updateAsanaDisplayNames();
        
        // Schedule asana list update for next frame to avoid blocking
        requestAnimationFrame(() => {
            // Only rebuild table if we're on build screen and have flows
            if (currentScreenId === 'buildScreen' && editingFlow && editingFlow.asanas && editingFlow.asanas.length > 0) {
                rebuildFlowTable();
            } else {
                // Otherwise just update the asana list
                populateAsanaList();
            }
        });
    });
}

function updateFlowScreenNames() {
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
    loadAsanasFromXML().then(async () => {
        // Display flows
        await displayFlows();

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
        showGroupSkipAlert('This pose is already in a group. A pose can only be in one group at a time.');
        
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
    
    // Create a modal dialog for confirmation
    const modal = document.createElement('div');
    modal.className = 'modal section-modal';
    modal.style.display = 'block';
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content delete-confirmation">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Delete Group</h2>
            <p class="modal-description">Are you sure you want to delete the group "<strong>${section.name}</strong>" with ${poseCount} pose${poseCount !== 1 ? 's' : ''}?</p>
            <p class="modal-warning">The poses will remain in your flow but will no longer be grouped.</p>
            <div class="confirmation-buttons">
                <button class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="delete-group-btn" onclick="confirmDeleteSection('${sectionId}')">Delete Group</button>
            </div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(modal);
}

// Function to confirm and execute section deletion
function confirmDeleteSection(sectionId) {
    // Close the modal
    const modal = document.querySelector('.section-modal');
    if (modal) modal.remove();
    
    // Get the section for the notification
    const section = editingFlow.getSectionById(sectionId);
    if (!section) return;
    
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
            // First, manually remove all section-related rows from the table
            // This ensures no group headers remain
            const allSectionElements = document.querySelectorAll(`tr[data-section-id="${sectionId}"]`);
            allSectionElements.forEach(element => {
                element.remove();
            });
            
            // Remove the section from the data model
            const sectionIndex = editingFlow.sections.findIndex(s => s.id === sectionId);
            if (sectionIndex !== -1) {
                editingFlow.sections.splice(sectionIndex, 1);
            }
            
            // Rebuild the table view
            rebuildTableView();
            
            // Show a notification
            showToastNotification(`Group "${section.name}" deleted`);
            
            // Always save after deleting a section
            autoSaveFlow();
        }, 300);
    } else {
        // Fallback if no animation is possible
        // Remove the section from the data model
        const sectionIndex = editingFlow.sections.findIndex(s => s.id === sectionId);
        if (sectionIndex !== -1) {
            editingFlow.sections.splice(sectionIndex, 1);
        }
        
        // Make sure to remove any UI elements related to this section
        const allSectionElements = document.querySelectorAll(`tr[data-section-id="${sectionId}"]`);
        allSectionElements.forEach(element => {
            element.remove();
        });
        
        // Rebuild the table view
        rebuildTableView();
        
        // Show a notification
        showToastNotification(`Group "${section.name}" deleted`);
        
        // Always save after deleting a section
        autoSaveFlow();
    }
}

// Handle enter key press in group name input
function handleGroupNameKeypress(event) {
    if (event.key === 'Enter') {
        createGroupFromSelection();
    }
}

function handleCustomPoseNameKeypress(event) {
    if (event.key === 'Enter') {
        createCustomPoseFromModal();
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
    
    // Get the count of selected poses
    const selectedCount = selectedIndices.length;
    
    // Update the modal description to show the pose count
    const modalDescription = document.querySelector('#groupNamingModal .modal-description');
    if (modalDescription) {
        modalDescription.textContent = `Enter a name for this group of ${selectedCount} pose${selectedCount !== 1 ? 's' : ''}:`;
    }
    
    // Display the modal
    const modal = document.getElementById('groupNamingModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Focus the input field
        setTimeout(() => {
            const input = document.getElementById('groupNameInput');
            if (input) {
                input.value = ''; // Clear previous input
                input.focus();
                
                // Remove any existing listeners to prevent duplicates
                input.removeEventListener('keyup', handleGroupNameKeypress);
                
                // Add enter key event listener
                input.addEventListener('keyup', handleGroupNameKeypress);
            }
        }, 100);
    }
}

// Function to close the group naming modal
function closeGroupNamingModal() {
    const modal = document.getElementById('groupNamingModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clean up event listener
        const input = document.getElementById('groupNameInput');
        if (input) {
            input.removeEventListener('keyup', handleGroupNameKeypress);
        }
    }
}

function closeCustomPoseNamingModal() {
    const modal = document.getElementById('customPoseNamingModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clean up event listener
        const input = document.getElementById('customPoseNameInput');
        if (input) {
            input.removeEventListener('keyup', handleCustomPoseNameKeypress);
        }
    }
}

// Function to create a new group from selected poses
// Function to change the side for all poses in a section
function changeSectionSide(selectElement) {
    const sectionId = selectElement.getAttribute('data-section-id');
    const newSide = selectElement.value;
    
    // If "--" is selected, don't do anything
    if (newSide === '--') {
        return;
    }
    
    console.log(`Changing all poses in section ${sectionId} to side: ${newSide}`);
    
    // Get all poses in this section
    const section = editingFlow.getSectionById(sectionId);
    if (!section) {
        console.error('Section not found:', sectionId);
        return;
    }
    
    // Update the side for all asanas in this section
    section.asanaIds.forEach(asanaIndex => {
        if (asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
            // Map Front to Center for internal storage consistency with XML
            const mappedSide = newSide === "Front" ? "Center" : newSide;
            editingFlow.asanas[asanaIndex].side = mappedSide;
        }
    });
    
    // Update the individual side dropdowns in the table to reflect the change
    const sectionRows = document.querySelectorAll(`tr[data-section-id="${sectionId}"]:not(.section-header)`);
    sectionRows.forEach(row => {
        const sideSelect = row.querySelector('select.side-select');
        if (sideSelect) {
            sideSelect.value = newSide;
        }
    });
    
    // Reset the section side dropdown back to "--"
    selectElement.value = '--';
    
    // Update flow duration and auto-save
    updateFlowDuration();
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
    
    console.log(`Successfully changed all poses in section "${section.name}" to side: ${newSide}`);
}

function createGroupFromSelection() {
    const nameInput = document.getElementById('groupNameInput');
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
        showGroupSkipAlert(`${alreadyGroupedPoses.length} pose${alreadyGroupedPoses.length !== 1 ? 's were' : ' was'} skipped because ${alreadyGroupedPoses.length !== 1 ? 'they are' : 'it is'} already in a group. A pose can only be in one group at a time.`);
    }
    
    if (validSelectedIndices.length === 0) {
        alert('No valid poses selected that can be grouped');
        
        // Close the modal
        closeGroupNamingModal();
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
    closeGroupNamingModal();
    
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
        showGroupSkipAlert(`${alreadyGroupedPoses.length} pose${alreadyGroupedPoses.length !== 1 ? 's were' : ' was'} skipped because ${alreadyGroupedPoses.length !== 1 ? 'they are' : 'it is'} already in a group. A pose can only be in one group at a time.`);
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
    const changeSideBtn = document.getElementById('changeSideBtn');
    const reverseBtn = document.getElementById('reverseOrderBtn');
    
    const selectedPoses = getSelectedAsanas();
    const hasSelectedPoses = selectedPoses.length > 0;
    const hasCopiedPoses = copiedPoses.length > 0;
    
    if (copyBtn) copyBtn.disabled = !hasSelectedPoses;
    if (pasteBtn) pasteBtn.disabled = !hasCopiedPoses;
    if (deleteBtn) deleteBtn.disabled = !hasSelectedPoses;
    if (saveSequenceBtn) saveSequenceBtn.disabled = !hasSelectedPoses;
    if (addToSectionBtn) addToSectionBtn.disabled = !hasSelectedPoses;
    if (changeSideBtn) changeSideBtn.disabled = !hasSelectedPoses;
    if (reverseBtn) reverseBtn.disabled = !hasSelectedPoses;
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
    
    // Add poses based on table ordering
    if (tableInDescendingOrder) {
        // When table is in descending order (largest to smallest),
        // add poses to the end of the array so they appear at the largest position number
        editingFlow.asanas.push(...newAsanas);
    } else {
        // When table is in ascending order (smallest to largest),
        // add poses to the beginning of the array so they appear at position 1
        editingFlow.asanas.unshift(...newAsanas);
    }
    
    // Update section indices to account for new poses at the beginning
    if (!tableInDescendingOrder) {
        // Only need to adjust sections when adding to the beginning
        editingFlow.sections.forEach(section => {
            // Bump all section asanaIds by the number of added poses
            section.asanaIds = section.asanaIds.map(id => id + newAsanas.length);
        });
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
    
    // Create a map of deleted indices to track which poses are being removed
    const deletedIndices = new Set();
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            deletedIndices.add(index);
        }
    });
    
    // Remove selected poses from the flow
    editingFlow.asanas = editingFlow.asanas.filter(asana => !asana.selected);
    
    // Update section references to account for the removed poses
    editingFlow.sections.forEach(section => {
        // First, remove any direct references to deleted poses
        section.asanaIds = section.asanaIds.filter(asanaId => !deletedIndices.has(asanaId));
        
        // Then, adjust the indices of the remaining poses to account for removed poses
        section.asanaIds = section.asanaIds.map(asanaId => {
            // Count how many deleted poses were before this index
            let offset = 0;
            for (let deletedIndex of deletedIndices) {
                if (deletedIndex < asanaId) {
                    offset++;
                }
            }
            // Adjust the index by subtracting the offset
            return asanaId - offset;
        });
    });
    
    // Rebuild the table
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Deleted ${selectedPoses.length} pose${selectedPoses.length !== 1 ? 's' : ''}`);
    
    // Always save after deletion
    autoSaveFlow();
}

// Function to reverse the order of selected poses
function reverseSelectedPoses() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) return;
    
    // Get indices of selected poses
    const selectedIndices = [];
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            selectedIndices.push(index);
        }
    });
    
    // Create array of selected poses with their original indices
    const selectedWithIndices = selectedIndices.map(index => ({
        asana: editingFlow.asanas[index],
        originalIndex: index
    }));
    
    // Reverse the array of selected poses
    selectedWithIndices.reverse();
    
    // Replace the selected poses in their original positions with the reversed order
    selectedWithIndices.forEach((item, reverseIndex) => {
        const originalIndex = selectedIndices[reverseIndex];
        editingFlow.asanas[originalIndex] = item.asana;
    });
    
    // Update section references if needed (maintain same indices but with reversed poses)
    editingFlow.sections.forEach(section => {
        // Section references remain the same since we're not changing indices, just swapping poses
    });
    
    // Rebuild the table to reflect the changes
    rebuildFlowTable();
    
    // Show notification
    showToastNotification(`Reversed ${selectedPoses.length} pose${selectedPoses.length !== 1 ? 's' : ''}`);
    
    // Save the changes
    autoSaveFlow();
}

// Function to show the change side modal
function showChangeSideModal() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) {
        showToastNotification('Please select poses first');
        return;
    }
    
    // Show the modal
    const modal = document.getElementById('changeSideModal');
    const sideSelect = document.getElementById('sideSelectModal');
    
    // Reset the select to default
    sideSelect.value = 'Left';
    
    // Display the modal
    modal.style.display = 'block';
    
    // Focus on the select element
    setTimeout(() => sideSelect.focus(), 100);
}

// Function to close the change side modal
function closeChangeSideModal() {
    const modal = document.getElementById('changeSideModal');
    modal.style.display = 'none';
}

// Function to change the side of all selected poses
function changeSelectedPosesSide() {
    const selectedPoses = getSelectedAsanas();
    if (selectedPoses.length === 0) {
        showToastNotification('No poses selected');
        closeChangeSideModal();
        return;
    }
    
    const sideSelect = document.getElementById('sideSelectModal');
    const newSide = sideSelect.value;
    
    if (!newSide) {
        showToastNotification('Please select a side');
        return;
    }
    
    console.log(`Changing ${selectedPoses.length} selected poses to side: ${newSide}`);
    
    // Update the side for all selected asanas
    let changedCount = 0;
    editingFlow.asanas.forEach((asana, index) => {
        if (asana.selected) {
            // Map Front to Center for internal storage consistency with XML
            const mappedSide = newSide === "Front" ? "Center" : newSide;
            asana.side = mappedSide;
            changedCount++;
        }
    });
    
    // Update the individual side dropdowns in the table to reflect the change
    const tableRows = document.querySelectorAll('#flowTable tr:not(:first-child):not(.section-header)');
    tableRows.forEach(row => {
        const asanaIndex = parseInt(row.getAttribute('data-index'));
        if (!isNaN(asanaIndex) && asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
            const asana = editingFlow.asanas[asanaIndex];
            if (asana.selected) {
                const sideSelect = row.querySelector('select.side-select');
                if (sideSelect) {
                    sideSelect.value = newSide;
                }
            }
        }
    });
    
    // Close the modal
    closeChangeSideModal();
    
    // Update flow duration and auto-save
    updateFlowDuration();
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
    
    // Show notification
    showToastNotification(`Changed ${changedCount} pose${changedCount !== 1 ? 's' : ''} to ${newSide} side`);
    
    console.log(`Successfully changed ${changedCount} poses to side: ${newSide}`);
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
        sequenceBadge.className = 'difficulty-badge sequence';
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

    // Add poses based on table ordering
    if (tableInDescendingOrder) {
        // When table is in descending order (largest to smallest),
        // add poses to the end of the array so they appear at the largest position number
        editingFlow.asanas.push(...newAsanas);
    } else {
        // When table is in ascending order (smallest to largest),
        // add poses to the beginning of the array so they appear at position 1
        editingFlow.asanas.unshift(...newAsanas);
        
        // Update section indices to account for new poses at the beginning
        editingFlow.sections.forEach(section => {
            // Bump all section asanaIds by the number of added poses
            section.asanaIds = section.asanaIds.map(id => id + newAsanas.length);
        });
    }
    
    // Create a new section for the sequence
    const sectionId = editingFlow.addSection(sequence.name);
    
    // Get the indices of the newly added asanas
    let asanaIndices = [];
    
    if (tableInDescendingOrder) {
        // In descending mode, asanas were added at the end
        const startIndex = editingFlow.asanas.length - newAsanas.length;
        for (let i = 0; i < newAsanas.length; i++) {
            asanaIndices.push(startIndex + i);
        }
    } else {
        // In ascending mode, asanas were added at the beginning (position 0 to n-1)
        for (let i = 0; i < newAsanas.length; i++) {
            asanaIndices.push(i);
        }
    }
    
    // Add all asanas from the sequence to the section
    asanaIndices.forEach(index => {
        editingFlow.addAsanaToSection(index, sectionId);
    });

    // Rebuild the table
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Loaded sequence "${sequence.name}" and added to a group`);
    
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
    // Show the custom pose naming modal
    const modal = document.getElementById('customPoseNamingModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Focus the input field
        setTimeout(() => {
            const input = document.getElementById('customPoseNameInput');
            if (input) {
                input.focus();
                input.value = '';
                
                // Remove existing event listener
                input.removeEventListener('keyup', handleCustomPoseNameKeypress);
                
                // Add enter key event listener
                input.addEventListener('keyup', handleCustomPoseNameKeypress);
            }
        }, 100);
    }
}

// Function to create custom pose from modal
function createCustomPoseFromModal() {
    const input = document.getElementById('customPoseNameInput');
    const poseName = input ? input.value.trim() : '';
    
    if (!poseName) {
        alert('Please enter a pose name');
        return;
    }

    // Close the modal
    closeCustomPoseNamingModal();

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

    // Add pose to global asanas array so it appears in the asana selection list
    asanas.push(customPose);

    // Save all custom poses to localStorage
    const customPoses = asanas.filter(asana => asana.tags.includes('Custom'));
    saveCustomPoses(customPoses);

    // Add pose based on table ordering
    if (tableInDescendingOrder) {
        // When table is in descending order (largest to smallest),
        // add pose to the end of the array so it appears at the largest position number
        editingFlow.asanas.push(customPose);
    } else {
        // When table is in ascending order (smallest to largest),
        // add pose to the beginning of the array so it appears at position 1
        editingFlow.asanas.unshift(customPose);
        
        // Update section indices to account for the new pose at the beginning
        editingFlow.sections.forEach(section => {
            // Bump all section asanaIds by 1
            section.asanaIds = section.asanaIds.map(id => id + 1);
        });
    }

    // Rebuild the table
    rebuildFlowTable();

    // Update flow duration
    updateFlowDuration();

    // Refresh the asana selection list to show the new custom pose
    populateAsanaList();

    // Show notification
    showToastNotification(`Added custom pose: ${poseName}`);
    
    // Log success for debugging
    console.log(`Successfully added custom pose "${poseName}" to both flow and asana selection list`);

    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to delete a custom pose
function deleteCustomPose(poseName) {
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to delete the custom pose "${poseName}"? This action cannot be undone.`)) {
        return; // User cancelled
    }

    try {
        // Remove from global asanas array
        const asanaIndex = asanas.findIndex(asana => asana.name === poseName && asana.tags.includes('Custom'));
        if (asanaIndex !== -1) {
            asanas.splice(asanaIndex, 1);
            console.log(`Removed custom pose "${poseName}" from asanas array`);
        }

        // Remove from current flow if it exists there
        if (editingFlow && editingFlow.asanas) {
            const flowAsanaIndices = [];
            editingFlow.asanas.forEach((asana, index) => {
                if (asana.name === poseName && asana.tags.includes('Custom')) {
                    flowAsanaIndices.push(index);
                }
            });
            
            // Remove in reverse order to avoid index shifting issues
            flowAsanaIndices.reverse().forEach(index => {
                editingFlow.asanas.splice(index, 1);
            });

            if (flowAsanaIndices.length > 0) {
                console.log(`Removed ${flowAsanaIndices.length} instances of custom pose "${poseName}" from current flow`);
                // Rebuild the flow table to reflect changes
                rebuildFlowTable();
                // Update flow duration
                updateFlowDuration();
            }
        }

        // Update localStorage with remaining custom poses
        const customPoses = asanas.filter(asana => asana.tags.includes('Custom'));
        saveCustomPoses(customPoses);

        // Refresh the asana selection list
        populateAsanaList();

        // Show success notification
        showToastNotification(`Deleted custom pose: ${poseName}`);
        
        console.log(`Successfully deleted custom pose "${poseName}"`);
        
    } catch (error) {
        console.error('Error deleting custom pose:', error);
        showToastNotification(`Error deleting custom pose: ${poseName}`);
    }
}

// Global variable to track which pose index is being swapped
let swapPoseIndex = null;

// Function to show the swap pose modal
function showSwapPoseModal(index) {
    swapPoseIndex = index;
    const modal = document.getElementById('swapPoseModal');
    const searchInput = document.getElementById('swapPoseSearch');
    const poseList = document.getElementById('swapPoseList');
    
    if (!modal || !searchInput || !poseList) return;
    
    // Clear search input
    searchInput.value = '';
    
    // Show modal
    modal.style.display = 'block';
    
    // Populate initial pose list
    populateSwapPoseList();
    
    // Focus search input
    setTimeout(() => {
        searchInput.focus();
    }, 100);
    
    // Add search event listener
    searchInput.oninput = function() {
        populateSwapPoseList(this.value.toLowerCase());
    };
}

// Function to close the swap pose modal
function closeSwapPoseModal() {
    const modal = document.getElementById('swapPoseModal');
    if (modal) {
        modal.style.display = 'none';
    }
    swapPoseIndex = null;
}

// Function to populate the swap pose list
function populateSwapPoseList(searchTerm = '') {
    const poseList = document.getElementById('swapPoseList');
    if (!poseList) return;
    
    // Clear existing list
    poseList.innerHTML = '';
    
    // Filter asanas based on search term
    let filteredAsanas = asanas;
    if (searchTerm) {
        filteredAsanas = asanas.filter(asana => {
            const nameMatch = asana.name.toLowerCase().includes(searchTerm);
            const sanskritMatch = asana.sanskrit && asana.sanskrit.toLowerCase().includes(searchTerm);
            return nameMatch || sanskritMatch;
        });
    }
    
    
    // Create pose items
    filteredAsanas.forEach(asana => {
        const poseItem = document.createElement('div');
        poseItem.className = 'swap-pose-item';
        
        // Create image
        const img = document.createElement('img');
        img.src = asana.image.startsWith('images/') ? asana.image : `images/webp/${asana.image}`;
        img.alt = asana.name;
        img.className = 'swap-pose-img';
        img.onerror = function() {
            this.onerror = null;
            this.src = 'images/webp/default-pose.webp';
            this.style.display = 'flex';
            this.style.justifyContent = 'center';
            this.style.alignItems = 'center';
            this.style.background = '#f5f5f5';
            this.style.fontSize = '20px';
            this.innerText = '🧘‍♀️';
        };
        
        // Create name
        const name = document.createElement('span');
        name.className = 'swap-pose-name';
        name.textContent = typeof asana.getDisplayName === 'function' ?
            asana.getDisplayName(useSanskritNames) :
            (useSanskritNames && asana.sanskrit ? asana.sanskrit : asana.name);
        
        
        // Add click handler
        poseItem.onclick = function() {
            swapPose(asana);
        };
        
        poseItem.appendChild(img);
        poseItem.appendChild(name);
        poseList.appendChild(poseItem);
    });
    
    // Show message if no poses found
    if (filteredAsanas.length === 0) {
        poseList.innerHTML = '<div class="no-matches">No poses found</div>';
    }
}

// Function to swap the pose
function swapPose(newAsana) {
    if (swapPoseIndex === null || swapPoseIndex < 0 || swapPoseIndex >= editingFlow.asanas.length) {
        console.error('Invalid swap pose index');
        return;
    }
    
    // Get the current pose to preserve its duration and side
    const currentPose = editingFlow.asanas[swapPoseIndex];
    const preservedDuration = currentPose.duration || 7;
    const preservedSide = currentPose.side || 'Center';
    
    // Create a new instance of the selected asana
    const swappedAsana = new YogaAsana(
        newAsana.name,
        preservedSide, // Keep the current side
        newAsana.image,
        newAsana.description,
        newAsana.difficulty,
        [...(newAsana.tags || [])],
        [...(newAsana.transitionsAsana || [])],
        newAsana.sanskrit,
        newAsana.chakra || ""
    );
    swappedAsana.setDuration(preservedDuration); // Keep the current duration
    
    // Replace the pose in the flow
    editingFlow.asanas[swapPoseIndex] = swappedAsana;
    
    // Close the modal
    closeSwapPoseModal();
    
    // Rebuild both views
    rebuildFlowTable();
    
    // Update flow duration
    updateFlowDuration();
    
    // Show notification
    showToastNotification(`Swapped to ${newAsana.name}`);
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}
