document.addEventListener('DOMContentLoaded', function() {
    // Game data
    const boggleDice = [
        'AACIOT', 'ABILTY', 'ABJMOQ', 'ACDEMP', 'ACELRS', 'ADENVZ', 'AHMORS', 'BIFORX', 'DENOSW', 'DKNOTU',
        'EEFHIY', 'EGKLUY', 'EGINTV', 'EHINPS', 'ELPSTU', 'GILRUW', 'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
        'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY', 'DISTTY'
    ];
    
    // UEB Braille patterns
    const braillePatterns = {
        'A': [1], 'B': [1, 2], 'C': [1, 4], 'D': [1, 4, 5], 'E': [1, 5], 'F': [1, 2, 4], 'G': [1, 2, 4, 5], 'H': [1, 2, 5],
        'I': [2, 4], 'J': [2, 4, 5], 'K': [1, 3], 'L': [1, 2, 3], 'M': [1, 3, 4], 'N': [1, 3, 4, 5], 'O': [1, 3, 5], 'P': [1, 2, 3, 4],
        'Q': [1, 2, 3, 4, 5], 'R': [1, 2, 3, 5], 'S': [2, 3, 4], 'T': [2, 3, 4, 5], 'U': [1, 3, 6], 'V': [1, 2, 3, 6], 
        'W': [2, 4, 5, 6], 'X': [1, 3, 4, 6], 'Y': [1, 3, 4, 5, 6], 'Z': [1, 3, 5, 6]
    };
    
    // Game state variables
    let board = [], selectedDice = [], currentWord = '', foundWords = [], score = 0;
    let gameTimer, timeLeft = 180, rerollsRemaining = 2, randomChangeTimer, validWords = [];
    let swapTimer, warningTimeouts = {};
    
    // Accessibility state variables
    let showPrintLetters = false, highContrastMode = false, soundVolume = 0.5, soundMuted = false;

    // Audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Cache DOM elements
    const els = {
        board: document.getElementById('board'),
        currentWord: document.getElementById('current-word'),
        submitBtn: document.getElementById('submit-btn'),
        clearBtn: document.getElementById('clear-btn'),
        newGameBtn: document.getElementById('new-game-btn'),
        rerollBtn: document.getElementById('reroll-btn'),
        rerollsRemaining: document.getElementById('rerolls-remaining'),
        wordList: document.getElementById('word-list'),
        timer: document.querySelector('.timer'),
        score: document.querySelector('.score'),
        gameOverModal: document.getElementById('game-over-modal'),
        finalScore: document.getElementById('final-score'),
        wordsFound: document.getElementById('words-found'),
        playAgainBtn: document.getElementById('play-again-btn'),
        printLettersToggle: document.getElementById('print-letters-toggle'),
        highContrastToggle: document.getElementById('high-contrast-toggle'),
        volumeSlider: document.getElementById('volume-slider'),
        soundIcon: document.getElementById('sound-icon'),
        screenReader: document.getElementById('screen-reader-announcer'),
        drawerToggle: document.getElementById('drawer-toggle'),
        drawerHandle: document.getElementById('drawer-handle'),
        instructionsDrawer: document.getElementById('instructions-drawer'),
        wordConfirmation: document.getElementById('word-confirmation')
    };
    
    // Fix for iOS rubber-band scrolling - only prevent horizontal scrolling
    document.body.addEventListener('touchmove', e => {
        // Allow vertical scrolling
        const touchY = e.touches[0].clientY;
        const isScrollableArea = e.target.classList.contains('word-list') || 
                                e.target.closest('.word-list');
                                
        // Only prevent default on horizontal scrolling or when in a specific scrollable area
        if (isScrollableArea) {
            return; // Allow scrolling in scrollable areas
        }
        
        // Check if the scroll is primarily horizontal
        if (Math.abs(e.touches[0].clientX - e._startX) > Math.abs(touchY - e._startY)) {
            e.preventDefault(); // Prevent only horizontal scrolling
        }
    }, { passive: false });
    
    // Store touch start position for scroll detection
    document.body.addEventListener('touchstart', e => {
        if (e.touches.length) {
            e._startX = e.touches[0].clientX;
            e._startY = e.touches[0].clientY;
        }
    }, { passive: true });
    
    // Initialize 
    initAccessibilityControls();
    initGame();
    
    // Initialize accessibility controls
    function initAccessibilityControls() {
        // Print letters toggle
        els.printLettersToggle.addEventListener('change', function() {
            showPrintLetters = this.checked;
            document.body.classList.toggle('show-print-letters', showPrintLetters);
            announce(showPrintLetters ? "Print letters are now visible." : "Print letters are now hidden.");
        });
        
        // High contrast mode toggle
        els.highContrastToggle.addEventListener('change', function() {
            highContrastMode = this.checked;
            document.body.classList.toggle('high-contrast', highContrastMode);
            announce(highContrastMode ? "High contrast mode enabled." : "High contrast mode disabled.");
        });
        
        // Volume slider
        els.volumeSlider.addEventListener('input', function() {
            soundVolume = this.value / 100;
            soundMuted = soundVolume === 0;
            els.soundIcon.textContent = soundMuted ? '🔇' : 
                                        soundVolume < 0.3 ? '🔈' : 
                                        soundVolume < 0.7 ? '🔉' : '🔊';
        });
        
        // Sound icon toggle mute
        els.soundIcon.addEventListener('click', function() {
            soundMuted = !soundMuted;
            if (soundMuted) {
                els.soundIcon.textContent = '🔇';
                announce("Sound muted.");
            } else {
                if (soundVolume === 0) soundVolume = 0.5;
                els.volumeSlider.value = soundVolume * 100;
                els.soundIcon.textContent = soundVolume < 0.3 ? '🔈' : soundVolume < 0.7 ? '🔉' : '🔊';
                announce("Sound unmuted.");
            }
        });
    }
    
    // Announce to screen reader
    function announce(message) {
        els.screenReader.textContent = message;
    }
    
    // Load word list
    function loadWordList() {
        try {
            if (typeof WORD_LIST !== 'undefined') {
                validWords = WORD_LIST.map(word => word.trim().toUpperCase());
            } else {
                throw new Error("Word list not available");
            }
        } catch (error) {
            console.error('Error loading word list:', error);
            validWords = ['CAT', 'DOG', 'PET', 'HAT', 'LEG', 'LET', 'GET', 'GOT'];
        }
    }
    
    // Initialize game
    function initGame() {
        // Reset game state
        board = [];
        selectedDice = [];
        currentWord = '';
        foundWords = [];
        score = 0;
        timeLeft = 180;
        rerollsRemaining = 2;
        
        // Load word list if not already loaded
        if (validWords.length === 0) loadWordList();
        
        // Update UI
        els.currentWord.textContent = '';
        els.wordList.innerHTML = '';
        els.score.textContent = 'Score: 0';
        els.timer.textContent = 'Time: 3:00';
        updateRerollCounter();
        
        // Clear timers
        [gameTimer, randomChangeTimer, swapTimer].forEach(timer => timer && clearInterval(timer));
        
        // Generate board and start timers
        generateBoard();
        renderBoard();
        startTimer();
        startRandomChangeTimer();
        startSwapTimer();
        
        // Enable buttons
        updateRerollButton();
        els.submitBtn.disabled = false;
        els.clearBtn.disabled = false;
        
        announce("New game started. The board has been generated with 25 braille letters. Find words by selecting adjacent tiles.");
    }
    
    // Generate board
    function generateBoard() {
        const shuffledDice = [...boggleDice].sort(() => Math.random() - 0.5);
        board = []; // Ensure board is cleared before adding new letters
        for (let i = 0; i < 25; i++) {
            const die = shuffledDice[i];
            const randomFace = die.charAt(Math.floor(Math.random() * die.length));
            board.push(randomFace);
        }
    }
    
    // Render board
    function renderBoard() {
        els.board.innerHTML = '';
        
        // Check viewport size for mobile optimization
        const isMobile = window.innerWidth < 400;
        
        for (let i = 0; i < 25; i++) {
            const letter = board[i];
            const dieElement = document.createElement('div');
            dieElement.className = 'die';
            dieElement.dataset.index = i;
            dieElement.setAttribute('role', 'gridcell');
            dieElement.setAttribute('aria-label', `Letter ${letter} in braille`);
            dieElement.setAttribute('tabindex', '0');
            
            // Create braille cell
            const brailleCell = document.createElement('div');
            brailleCell.className = 'braille-cell';
            
            for (let dot = 1; dot <= 6; dot++) {
                const dotElement = document.createElement('div');
                dotElement.className = 'braille-dot';
                if (braillePatterns[letter] && braillePatterns[letter].includes(dot)) {
                    dotElement.classList.add('filled');
                }
                brailleCell.appendChild(dotElement);
            }
            
            // Add print letter display
            const printLetter = document.createElement('div');
            printLetter.className = 'print-letter';
            printLetter.textContent = letter;
            printLetter.setAttribute('aria-hidden', 'true');
            
            dieElement.appendChild(brailleCell);
            dieElement.appendChild(printLetter);
            els.board.appendChild(dieElement);
            
            // Enhanced mobile touch handling
            if (isMobile) {
                // Create a more touch-friendly experience
                dieElement.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    this.classList.add('active-touch');
                }, {passive: false});
                
                dieElement.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    this.classList.remove('active-touch');
                    handleDieClick({currentTarget: this});
                }, {passive: false});
                
                dieElement.addEventListener('touchcancel', function() {
                    this.classList.remove('active-touch');
                });
            } else {
                // Standard mouse click for desktop
                dieElement.addEventListener('click', handleDieClick);
            }
            
            // Keyboard support
            dieElement.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') handleDieClick(e);
            });
        }
    }
    
    // Update die
    function updateDie(index, newLetter) {
        const dieElement = document.querySelector(`.die[data-index="${index}"]`);
        if (!dieElement) return;
        
        dieElement.setAttribute('aria-label', `Letter ${newLetter} in braille`);
        
        // Update braille
        const brailleCell = dieElement.querySelector('.braille-cell');
        brailleCell.innerHTML = '';
        
        for (let dot = 1; dot <= 6; dot++) {
            const dotElement = document.createElement('div');
            dotElement.className = 'braille-dot';
            if (braillePatterns[newLetter] && braillePatterns[newLetter].includes(dot)) {
                dotElement.classList.add('filled');
            }
            brailleCell.appendChild(dotElement);
        }
        
        // Update print letter
        const printLetter = dieElement.querySelector('.print-letter');
        if (printLetter) printLetter.textContent = newLetter;
        
        // Animation
        dieElement.classList.add('changing');
        setTimeout(() => dieElement.classList.remove('changing'), 1000);
    }
    
    // Random letter change
    function randomLetterChange() {
        // Select random die not currently selected
        let availableDice = [];
        for (let i = 0; i < 25; i++) {
            if (!selectedDice.includes(i)) availableDice.push(i);
        }
        
        if (availableDice.length === 0) return;
        
        const randomIndex = availableDice[Math.floor(Math.random() * availableDice.length)];
        const dieLetter = board[randomIndex];
        
        // Add warning
        const dieElement = document.querySelector(`.die[data-index="${randomIndex}"]`);
        dieElement.classList.add('warning-change');
        dieElement.dataset.warning = 'change';
        
        dieElement.setAttribute('aria-label', `Warning: Letter ${dieLetter} in braille is about to change. Click to prevent change.`);
        
        announce(`Warning: A letter is about to change at position ${randomIndex + 1}. Click to prevent change.`);
        
        playSound('warningChange');
        
        warningTimeouts[randomIndex] = setTimeout(() => {
            if (dieElement.classList.contains('warning-change')) {
                dieElement.classList.remove('warning-change');
                delete dieElement.dataset.warning;
                
                // Generate new letter
                const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const newLetter = allLetters.replace(dieLetter, '').charAt(Math.floor(Math.random() * 25));
                
                board[randomIndex] = newLetter;
                updateDie(randomIndex, newLetter);
                playSound('letterChange');
                
                announce(`Letter at position ${randomIndex + 1} changed from ${dieLetter} to ${newLetter}.`);
            }
        }, 3000);
    }
    
    // Start random letter change timer
    function startRandomChangeTimer() {
        randomChangeTimer = setInterval(randomLetterChange, 10000);
    }
    
    // Handle die click
    function handleDieClick(event) {
        const dieElement = event.currentTarget;
        const index = parseInt(dieElement.dataset.index);
        
        // Check if warning state
        if (dieElement.dataset.warning) {
            const warningType = dieElement.dataset.warning;
            let partnerIndex = null;
            
            // Cancel pending change/swap
            if (warningTimeouts[index]) {
                clearTimeout(warningTimeouts[index]);
                delete warningTimeouts[index];
            }
            
            // If swap, cancel partner
            if (warningType === 'swap' && dieElement.dataset.swapPartner) {
                partnerIndex = parseInt(dieElement.dataset.swapPartner);
                const partnerElement = document.querySelector(`.die[data-index="${partnerIndex}"]`);
                
                if (partnerElement) {
                    partnerElement.classList.remove('warning-swap');
                    delete partnerElement.dataset.warning;
                    delete partnerElement.dataset.swapPartner;
                    
                    partnerElement.setAttribute('aria-label', `Letter ${board[partnerIndex]} in braille`);
                    
                    if (warningTimeouts[partnerIndex]) {
                        clearTimeout(warningTimeouts[partnerIndex]);
                        delete warningTimeouts[partnerIndex];
                    }
                }
            }
            
            // Remove warning
            dieElement.classList.remove('warning-change', 'warning-swap');
            delete dieElement.dataset.warning;
            
            dieElement.setAttribute('aria-label', `Letter ${board[index]} in braille`);
            
            // Saved animation
            dieElement.classList.add('saved');
            setTimeout(() => dieElement.classList.remove('saved'), 800);
            
            playSound('tileSaved');
            
            announce(warningType === 'change' 
                ? `Change prevented for letter at position ${index + 1}.`
                : `Swap prevented for letters at positions ${index + 1}${partnerIndex !== null ? ` and ${partnerIndex + 1}` : ''}.`);
            
            return;
        }
        
        // Selection logic
        if (selectedDice.includes(index)) return;
        
        // Check adjacency
        if (selectedDice.length > 0) {
            const lastIndex = selectedDice[selectedDice.length - 1];
            if (!isAdjacent(lastIndex, index)) {
                announce("This tile is not adjacent to your last selection.");
                return;
            }
        }
        
        // Add to selected
        selectedDice.push(index);
        dieElement.classList.add('selected');
        dieElement.setAttribute('aria-selected', 'true');
        
        // Update word
        currentWord += board[index];
        els.currentWord.textContent = currentWord;
        
        // Provide haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate(20);
        
        announce(`Added letter ${board[index]}. Current word: ${currentWord}.`);
    }
    
    // Check adjacency
    function isAdjacent(index1, index2) {
        const row1 = Math.floor(index1 / 5);
        const col1 = index1 % 5;
        const row2 = Math.floor(index2 / 5);
        const col2 = index2 % 5;
        
        return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1;
    }
    
    // Clear selection
    function clearSelection() {
        selectedDice.forEach(index => {
            const dieElement = document.querySelector(`.die[data-index="${index}"]`);
            if (dieElement) {
                dieElement.classList.remove('selected');
                dieElement.setAttribute('aria-selected', 'false');
            }
        });
        
        selectedDice = [];
        currentWord = '';
        els.currentWord.textContent = '';
        
        announce("Selection cleared.");
    }
    
    // Submit word
    function submitWord() {
        // Validate word
        if (currentWord.length < 3) {
            announce("Words must be at least 3 letters long.");
            alert('Words must be at least 3 letters long.');
            return;
        }
        
        if (foundWords.includes(currentWord)) {
            announce("You already found this word!");
            alert('You already found this word!');
            clearSelection();
            return;
        }
        
        // Check if valid
        if (!validWords.includes(currentWord)) {
            showConfirmation(`"${currentWord}" is not a valid word!`, false);
            announce(`"${currentWord}" is not a valid word!`);
            clearSelection();
            return;
        }
        
        // Add to found words
        foundWords.push(currentWord);
        
        // Update score
        const wordScore = calculateWordScore(currentWord);
        score += wordScore;
        els.score.textContent = `Score: ${score}`;
        
        // Add to word list
        addWordToList(currentWord, wordScore);
        
        // Show confirmation
        showConfirmation(`${currentWord}: +${wordScore} points!`, true);
        
        playSound('wordFound');
        
        // Provide haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
        
        announce(`Word "${currentWord}" found! You earned ${wordScore} points. Your total score is now ${score}.`);
        
        clearSelection();
    }
    
    // Add word to list
    function addWordToList(word, score) {
        const wordItem = document.createElement('li');
        const wordText = document.createElement('span');
        wordText.textContent = word;
        
        const wordScore = document.createElement('span');
        wordScore.textContent = `+${score}`;
        wordScore.className = 'word-score';
        
        wordItem.appendChild(wordText);
        wordItem.appendChild(wordScore);
        wordItem.className = 'word-item-new';
        els.wordList.appendChild(wordItem);
        
        setTimeout(() => wordItem.className = '', 1200);
    }
    
    // Show confirmation
    function showConfirmation(text, isSuccess) {
        els.wordConfirmation.textContent = text;
        els.wordConfirmation.style.background = isSuccess ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)';
        els.wordConfirmation.style.boxShadow = isSuccess ? '0 5px 25px rgba(46, 204, 113, 0.5)' : '0 5px 25px rgba(231, 76, 60, 0.5)';
        els.wordConfirmation.classList.add('show');
        
        setTimeout(() => {
            els.wordConfirmation.classList.remove('show');
            els.wordConfirmation.style.background = '';
            els.wordConfirmation.style.boxShadow = '';
        }, 1500);
    }
    
    // Reroll dice
    function rerollDice() {
        if (rerollsRemaining <= 0) return;
        
        clearSelection();
        playSound('reroll');
        
        // Provide haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate([20, 20, 40, 20, 60]);
        
        announce("Rerolling dice positions. Letters will remain the same but positions will change.");
        
        els.board.classList.add('rerolling');
        
        // Animate dice
        const diceElements = document.querySelectorAll('.die');
        diceElements.forEach((die, index) => {
            die.classList.add('rerolling');
            
            const randomHue = Math.floor(Math.random() * 360);
            die.style.background = `hsla(${randomHue}, 70%, 85%, 0.9)`;
            
            const randomX = (Math.random() - 0.5) * 30;
            const randomY = (Math.random() - 0.5) * 30;
            const randomZ = Math.random() * 50;
            die.style.transform = `translate3d(${randomX}px, ${randomY}px, ${randomZ}px)`;
            
            setTimeout(() => {
                die.style.transition = 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
            }, index * 10);
        });
        
        // After animation
        setTimeout(() => {
            // Shuffle board
            shuffleArray(board);
            
            // Reset dice with a gentle transition
            diceElements.forEach(die => {
                die.style.transform = '';
                die.style.background = '';
                die.style.transition = 'all 0.5s ease-out';
                die.classList.remove('rerolling');
            });
            
            els.board.classList.remove('rerolling');
            renderBoard();
            
            // Update rerolls
            rerollsRemaining--;
            updateRerollCounter();
            updateRerollButton();
            
            announce(`Positions scrambled! You have ${rerollsRemaining} reroll${rerollsRemaining === 1 ? '' : 's'} remaining.`);
        }, 1200);
    }
    
    // Shuffle array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    // Update reroll counter
    function updateRerollCounter() {
        els.rerollsRemaining.textContent = rerollsRemaining;
    }
    
    // Update reroll button
    function updateRerollButton() {
        els.rerollBtn.disabled = rerollsRemaining <= 0;
        els.rerollBtn.setAttribute('aria-label', rerollsRemaining <= 0 ? 
            'No rerolls remaining' : `Reroll positions (${rerollsRemaining} remaining)`);
    }
    
    // Calculate word score
    function calculateWordScore(word) {
        const length = word.length;
        if (length <= 4) return 1;
        if (length === 5) return 2;
        if (length === 6) return 3;
        if (length === 7) return 5;
        return 11; // 8+ letters
    }
    
    // Start timer
    function startTimer() {
        gameTimer = setInterval(function() {
            timeLeft--;
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            els.timer.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Announce time milestones
            if ([60, 30, 10].includes(timeLeft)) {
                announce(`${timeLeft === 60 ? 'One minute' : timeLeft} seconds remaining.`);
            }
            
            if (timeLeft <= 0) endGame();
        }, 1000);
    }
    
    // End game
    function endGame() {
        // Clear timers
        [gameTimer, randomChangeTimer, swapTimer].forEach(timer => timer && clearInterval(timer));
        
        playSound('gameOver');
        createConfetti();
        
        // Get message
        const celebrationMessage = getCelebrationMessage();
        
        // Update modal
        els.finalScore.textContent = score;
        els.wordsFound.textContent = foundWords.length;
        document.getElementById('celebration-message').textContent = celebrationMessage;
        els.gameOverModal.style.display = 'flex';
        
        // Disable board
        document.querySelectorAll('.die').forEach(die => {
            die.removeEventListener('click', handleDieClick);
            die.setAttribute('aria-disabled', 'true');
            die.setAttribute('tabindex', '-1');
        });
        
        els.submitBtn.disabled = true;
        els.clearBtn.disabled = true;
        els.rerollBtn.disabled = true;
        
        // Provide haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 80]);
        
        announce(`Game over! Your final score is ${score} points with ${foundWords.length} words found. ${celebrationMessage}`);
    }
    
    // Get celebration message
    function getCelebrationMessage() {
        if (score >= 50) return "Amazing job! You're a braille master!";
        if (score >= 30) return "Great work! Your braille skills are impressive!";
        if (score >= 15) return "Well done! You're getting good at braille!";
        return "Good effort! Keep practicing your braille skills!";
    }
    
    // Create confetti
    function createConfetti() {
        const confettiContainer = document.getElementById('confetti-container');
        confettiContainer.innerHTML = '';
        
        // Use fewer confetti pieces on mobile to prevent performance issues
        const confettiCount = window.innerWidth < 500 ? 75 : 150;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            const left = Math.random() * 100;
            const size = Math.random() * 8 + 4; // Smaller sizes for mobile
            const duration = Math.random() * 2.5 + 2.5;
            const delay = Math.random() * 1.5;
            
            const shapes = ['50%', '0%', '50% 0 0 50%'];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            
            Object.assign(confetti.style, {
                background: color,
                left: `${left}%`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: shape,
                animation: `confettiFall ${duration}s ease-in ${delay}s forwards`
            });
            
            confettiContainer.appendChild(confetti);
        }
    }
    
    // Play sound with softer effects
    function playSound(type) {
        if (soundMuted) return;
        
        // Try to ensure AudioContext is running on iOS
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        const volume = soundVolume * 0.5; // Reduce overall volume for mobile
        const currentTime = audioContext.currentTime;
        
        // Sound settings
        const sounds = {
            'wordFound': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(880, currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.15 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            },
            'gameOver': () => {
                oscillator.type = 'triangle';
                gainNode.gain.linearRampToValueAtTime(0.15 * volume, currentTime + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            },
            'warningChange': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(550, currentTime);
                oscillator.frequency.linearRampToValueAtTime(380, currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.06 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            },
            'warningSwap': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(350, currentTime);
                oscillator.frequency.linearRampToValueAtTime(280, currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.06 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            },
            'tileSaved': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(700, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1400, currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.12 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            },
            'reroll': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(600, currentTime);
                oscillator.frequency.linearRampToValueAtTime(300, currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.10 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.4);
                oscillator.start();
                oscillator.stop(currentTime + 0.4);
            },
            'letterChange': () => {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(500, currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(250, currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.10 * volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, currentTime + 0.3);
                oscillator.start();
                oscillator.stop(currentTime + 0.3);
            }
        };
        
        // Play the sound
        if (sounds[type]) sounds[type]();
    }
    
    // Handle swapping tiles
    function swapAdjacentTiles() {
        if (board.length < 2) return;
        
        // Find random adjacent tiles
        const index1 = Math.floor(Math.random() * 25);
        const row1 = Math.floor(index1 / 5);
        const col1 = index1 % 5;
        
        // Get adjacent positions
        const adjacentPositions = [];
        
        for (let r = Math.max(0, row1 - 1); r <= Math.min(4, row1 + 1); r++) {
            for (let c = Math.max(0, col1 - 1); c <= Math.min(4, col1 + 1); c++) {
                const adjIndex = r * 5 + c;
                if (adjIndex !== index1) adjacentPositions.push(adjIndex);
            }
        }
        
        if (adjacentPositions.length === 0) return;
        
        const index2 = adjacentPositions[Math.floor(Math.random() * adjacentPositions.length)];
        
        // Get dice
        const die1 = document.querySelector(`.die[data-index="${index1}"]`);
        const die2 = document.querySelector(`.die[data-index="${index2}"]`);
        
        if (!die1 || !die2) return;
        
        // Add warning class to both dice
        die1.classList.add('warning-swap');
        die1.dataset.warning = 'swap';
        die1.dataset.swapPartner = index2;
        
        die2.classList.add('warning-swap');
        die2.dataset.warning = 'swap';
        die2.dataset.swapPartner = index1;
        
        // Update ARIA
        die1.setAttribute('aria-label', `Warning: Letter ${board[index1]} in braille is about to swap with letter ${board[index2]}. Click to prevent swap.`);
        die2.setAttribute('aria-label', `Warning: Letter ${board[index2]} in braille is about to swap with letter ${board[index1]}. Click to prevent swap.`);
        
        announce(`Warning: Two letters are about to swap at positions ${index1 + 1} and ${index2 + 1}. Click either one to prevent the swap.`);
        
        playSound('warningSwap');
        
        // Set timeout
        const swapTimeout = setTimeout(() => {
            if (die1.classList.contains('warning-swap') && die2.classList.contains('warning-swap')) {
                // Remove warnings
                die1.classList.remove('warning-swap');
                delete die1.dataset.warning;
                delete die1.dataset.swapPartner;
                
                die2.classList.remove('warning-swap');
                delete die2.dataset.warning;
                delete die2.dataset.swapPartner;
                
                // Swap letters
                [board[index1], board[index2]] = [board[index2], board[index1]];
                
                // Update visuals
                updateDie(index1, board[index1]);
                updateDie(index2, board[index2]);
                
                // Animation
                die1.classList.add('swapping');
                die2.classList.add('swapping');
                
                setTimeout(() => {
                    die1.classList.remove('swapping');
                    die2.classList.remove('swapping');
                }, 1000);
                
                // Provide haptic feedback on supported devices
                if (navigator.vibrate) navigator.vibrate([15, 15, 15]);
                
                announce(`Letters swapped at positions ${index1 + 1} and ${index2 + 1}.`);
            }
        }, 3000);
        
        // Store timeouts
        warningTimeouts[index1] = swapTimeout;
        warningTimeouts[index2] = swapTimeout;
    }
    
    // Start swap timer
    function startSwapTimer() {
        if (swapTimer) clearInterval(swapTimer);
        
        swapTimer = setInterval(swapAdjacentTiles, 8000);
        
        // First swap happens after a short delay
        setTimeout(swapAdjacentTiles, 3000);
    }
    
    // Set up UI event listeners
    els.drawerToggle.addEventListener('click', toggleInstructions);
    els.drawerToggle.addEventListener('touchend', e => { e.preventDefault(); toggleInstructions(); });
    
    els.drawerHandle.addEventListener('click', closeInstructions);
    els.drawerHandle.addEventListener('touchend', e => { e.preventDefault(); closeInstructions(); });
    
    function toggleInstructions() {
        els.instructionsDrawer.classList.toggle('open');
        els.drawerToggle.setAttribute('aria-expanded', els.instructionsDrawer.classList.contains('open'));
        announce(els.instructionsDrawer.classList.contains('open') 
            ? "Instructions panel opened." 
            : "Instructions panel closed.");
    }
    
    function closeInstructions() {
        els.instructionsDrawer.classList.remove('open');
        els.drawerToggle.setAttribute('aria-expanded', 'false');
        announce("Instructions panel closed.");
    }
    
    // Game control events
    els.submitBtn.addEventListener('click', submitWord);
    els.clearBtn.addEventListener('click', clearSelection);
    els.newGameBtn.addEventListener('click', initGame);
    els.rerollBtn.addEventListener('click', rerollDice);
    els.playAgainBtn.addEventListener('click', () => {
        els.gameOverModal.style.display = 'none';
        initGame();
    });
    
    // Add touch events for better mobile response
    [els.submitBtn, els.clearBtn, els.newGameBtn, els.rerollBtn, els.playAgainBtn].forEach(btn => {
        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            if (!this.disabled) this.click();
        });
    });
    
    // Fix for iOS and Android touch device issues
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    
    // Allow scrolling only within scrollable elements
    document.querySelectorAll('.word-list').forEach(el => {
        el.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    });
    
    // Initialize with any additional settings
    window.onload = function() {
        // Handle scroll position restoration
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        
        // Update instructions text
        const lastP = document.querySelector('.drawer-content p:last-of-type');
        lastP.innerHTML = "<strong>Challenge:</strong> Every 10 seconds, one random die will change its letter! <strong>Every 8 seconds</strong>, two adjacent tiles will swap positions!";
        
        // Enable print letters on small screens
        if (window.innerWidth < 600 && !showPrintLetters) {
            els.printLettersToggle.checked = true;
            els.printLettersToggle.dispatchEvent(new Event('change'));
        }
        
        // Set up audio context for iOS
        document.addEventListener('touchstart', () => {
            if (audioContext.state === 'suspended') audioContext.resume();
        }, { once: true });
        
        // Force reset swap timer
        setTimeout(() => {
            if (swapTimer) clearInterval(swapTimer);
            swapTimer = setInterval(swapAdjacentTiles, 8000);
        }, 1000);
        
        // Scroll to top when game loads
        window.scrollTo(0, 0);
    };
});