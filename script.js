document.addEventListener('DOMContentLoaded', () => {
    //
    const thumbnailView = document.getElementById('thumbnail-view');
    const lightbox = document.getElementById('lightbox');
    const loadingSpinner = document.getElementById('loading-spinner');
    const enlargedImage = document.getElementById('enlarged-image');
    const imageCaption = document.getElementById('image-caption');

    const searchInput = document.getElementById('search-input');
    const clearSearchButton = document.getElementById('clear-search');

    // NEW: Navigation buttons
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    // NEW: Slideshow button
    const slideshowButton = document.getElementById('slideshow-button');
    const lightboxSlideshowButton = document.getElementById('play-button');

    const navButtons = document.getElementById('nav-buttons');

    // **IMPORTANT: Replace this with your actual published CSV link**
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFFIiRQNWYxq1hNvdK6H1LVydbBvUUJ98HmWuohgqksd2c062otJl7fEnUmYbTTXxsZYyOEL1g_KlC/pub?output=csv';

    const elem = document.documentElement;

    let viewMode = 'manual'; // 'manual' or 'slideshow'

    /* View in fullscreen */
    function openFullscreen() {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    }

    /* Close fullscreen */
    function closeFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }

    

    let imageData = []; // Stores all fetched image data
    let currentThumbnails = []; // Stores references to the actual thumbnail DOM elements
    let filteredImageData = []; // Stores the currently visible images (based on search)
    let currentImageIndexInFilteredList = -1; // Index of the currently viewed image within filteredImageData
    let latestImageViewed = 0;

    // NEW: Slideshow variables
    let slideshowInterval = null; // Holds the interval ID
    const SLIDESHOW_DELAY = 6000; // 3 seconds per image
    const FADE_DURATION = 500; // 0.5 seconds for fade effect (matches CSS transition)

    // Function to fetch and parse CSV data
    async function fetchImageData() {
        try {
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            imageData = parseCsvToJSON(csvText); // Parse the CSV
            // Initially, filteredImageData is all imageData
            filteredImageData = [...imageData]; // Use spread to create a shallow copy
            renderThumbnails(imageData); // Initial render of all thumbnails
            checkPageParam();
            
        } catch (error) {
            console.error("Could not fetch or parse image data from Google Sheet:", error);
            thumbnailView.innerHTML = '<p>Error loading images from Google Sheet. Please check the URL and sharing settings.</p>';
        }
    }

    function extractID(imageURL) {
        let photoID;
        if (imageURL.includes("id=")) {

            photoID = imageURL.split("id=")[1];

        } else if (imageURL.includes("/d/")) {

            photoID = imageURL.split("/d/")[1];

        }

        return photoID;

    }

    function checkPageParam(){
        const urlSearchParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlSearchParams.entries());
        console.log("URL Parameters:", params); // Log URL parameters for debugging
        if(params['view']){
            console.log("View specific image! ", params['view']);
            showLightbox(params['view']);
            // You can add more debug-specific code here if needed
        }else{
            console.log("No specific image!");
        }
    }
    

    function regExMatch(str){
        // regex for grouping values
        // This regex captures up to 4 groups of values separated by commas.
        // It allows for optional values in the second and third groups, and captures everything else in the fourth group.
        // This is useful for handling CSV files with varying numbers of columns.
        const regex = /^([^,]+)(?:,([^,]+))?(?:,([^,]+))?(?:,(.*))?$/g;

        // Alternative syntax using RegExp constructor
        // const regex = new RegExp('^([^,]+)(?:,([^,]+))?(?:,([^,]+))?(?:,(.*))?$', 'g')

        //test string for regex matching
        //const str = `2/23/2025 20:56:43,sarah.s.roberts@gmail.com,https://drive.google.com/open?id=1ATAxpQ7puldruGOvrRclCmKF7d9s9qWI,The Fragoberts Fam - Kyle, Sarah, Lex , & Henry at the Atl United Game on 2-22-25, at lejrnjer`;

        // Reset `lastIndex` if this regex is defined globally
        // regex.lastIndex = 0;

        // console.log(`Checking string: ${str} - ${typeof str}`);
        let m;

        let groups = [];

        while ((m = regex.exec(str.trim())) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            // The result can be accessed through the `m`-variable.
            m.forEach((match, groupIndex) => {
                // console.log(`Found match, group ${groupIndex}: ${match}`);
                groups.push(match);
            });
        }

        return groups;
    }

    function parseCsvToJSON(csv) {

        //separate lines by newline
        const lines = csv.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim()); // Get headers from the first line
        console.log(`Headers found: ${headers}`); // Log headers for debugging
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            // console.log(`Processing row ${i+1}: ${lines[i]}`); // Log each row being processed

            let regExGroups = regExMatch(lines[i]);
            
            const item = {};
            for (let j = 0; j < regExGroups.length; j++) {
                // Trim whitespace and handle potential quotes in values
                let value = regExGroups[j+1];
                if (typeof value == "string") {
                    if (value.endsWith(',')){
                        value = value.substring(0, value.length - 1); // Remove comma at the end
                    }
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1); // Remove quotes
                    }
                     
                }
                item[headers[j]] = value;
            }
            console.log(`Parsed item: ${item}`); // Log the parsed item for debugging
            data.push(item);
        }
        return data;
    }

    // Parses CSV text into an array of JSON objects (same as before)
    // function parseCsvToJSON2(csv) {
    //     const lines = csv.trim().split('\n');
    //     if (lines.length === 0) return [];

    //     const headers = lines[0].split(',').map(header => header.trim());
    //     const data = [];

    //     for (let i = 1; i < lines.length; i++) {
    //         const currentLine = lines[i].split(',');
    //         if (currentLine.length !== headers.length) {
    //             console.warn(`Skipping row ${i+1} due to column mismatch.`);
    //             continue;
    //         }
    //         const item = {};
    //         for (let j = 0; j < headers.length; j++) {
    //             let value = currentLine[j].trim();
    //             if (value.startsWith('"') && value.endsWith('"')) {
    //                 value = value.substring(1, value.length - 1);
    //             }
    //             item[headers[j]] = value;
    //         }
    //         data.push(item);
    //     }
    //     return data;
    // }

    // Function to render thumbnails (modified to store references)
    function renderThumbnails(images) {
        thumbnailView.innerHTML = '';
        currentThumbnails = [];

        images.forEach((image, index) => {
            const thumbDiv = document.createElement('div');
            thumbDiv.classList.add('thumbnail-item');
            // Store the original index from the 'imageData' array
            thumbDiv.dataset.originalIndex = index;
            thumbDiv.dataset.caption = image.Caption ? image.Caption.toLowerCase() : '';

            const tooltip = document.createElement('span');
            tooltip.setAttribute('class', 'tooltiptext');
            //index + 2 to account for the header row in the CSV
            tooltip.textContent = `${index+2}. ${image.Caption}` || 'No caption';
            

            const img = document.createElement('img');
            console.log(``);
            let photoID = extractID(image.Photo);
            img.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s300`;
            img.alt = image.Caption;
            
            thumbDiv.appendChild(img);
            thumbDiv.appendChild(tooltip);
            thumbnailView.appendChild(thumbDiv);

            // When a thumbnail is clicked, find its index within the *currently filtered* list
            thumbDiv.addEventListener('click', () => {
                
                const originalIndexClicked = parseInt(thumbDiv.dataset.originalIndex);
                latestImageViewed = originalIndexClicked;
                const indexInFiltered = filteredImageData.findIndex(img => imageData.indexOf(img) === originalIndexClicked);
                console.log(`Thumbnail clicked - Original Index: ${originalIndexClicked}, Filtered Index: ${indexInFiltered}`);
                if (indexInFiltered !== -1) {
                    showLightbox(indexInFiltered);
                }
            });
            currentThumbnails.push(thumbDiv);
        });
    }

    // Filter thumbnails based on search input (modified to update filteredImageData)
    function filterThumbnails() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredImageData = []; // Reset filtered data

        currentThumbnails.forEach(thumbDiv => {
            const caption = thumbDiv.dataset.caption;
            const originalIndex = parseInt(thumbDiv.dataset.originalIndex); // Get original index

            if (caption.includes(searchTerm) || searchTerm === '') {
                thumbDiv.classList.remove('hidden-by-search');
                filteredImageData.push(imageData[originalIndex]); // Add to filtered data
            } else {
                thumbDiv.classList.add('hidden-by-search');
            }
        });
        // Important: If a lightbox is open, close it if its image is no longer in the filtered list
        // Or, more simply, ensure it only works on visible thumbs.
        // For this implementation, we assume lightbox is closed before filtering or user knows to close.
        // A more robust solution might auto-close or jump to a new image if current image is filtered out.
    }

    // NEW EVENT LISTENERS for search bar
    searchInput.addEventListener('input', filterThumbnails);

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        filterThumbnails();
        searchInput.focus();
    });

    // Function to show the lightbox with loading spinner (modified to use filteredImageData)
    function showLightbox(indexInFilteredList) {
        console.log(`Showing lightbox for index: ${indexInFilteredList}`);
        if (indexInFilteredList < 0 || indexInFilteredList >= filteredImageData.length) {
            console.error("Invalid index for lightbox:", indexInFilteredList);
            return;
        }

        currentImageIndexInFilteredList = indexInFilteredList;
        const image = filteredImageData[currentImageIndexInFilteredList]; // Get image from filtered list
        // Hide old image/caption and show spinner immediately for fade-out
        console.log("Adding fading class!");
        // enlargedImage.classList.add('fading'); // Start fade-out
        // imageCaption.classList.add('fading');
        loadingSpinner.classList.remove('hidden');
        navButtons.classList.add('hidden');

        enlargedImage.classList.add('hidden'); // Hide display to prevent showing old image after fade-out
        imageCaption.classList.add('hidden');

        // Update UI to show/hide navigation buttons if only one image in filtered list
        if (filteredImageData.length <= 1) {
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        } else {
            prevButton.style.display = 'block'; // Or 'inline-block' depending on desired layout
            nextButton.style.display = 'block';
        }

        setTimeout(() => {
            enlargedImage.style.opacity = 0; 
            let photoID = extractID(image.Photo);
            let caption = `${currentImageIndexInFilteredList+1}. ${image.Caption || 'No caption'}`; // Corrected index for display

            enlargedImage.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s1200`;
            enlargedImage.alt = caption;
            imageCaption.textContent = caption;

            loadingSpinner.classList.add('hidden');

            enlargedImage.onload = () => {
                
                enlargedImage.classList.remove('hidden'); // Remove hidden and fading
                imageCaption.classList.remove('hidden'); // Show and un-fade
                if(viewMode === 'manual'){
                    navButtons.classList.remove('hidden');
                }
                
                setTimeout(() => {
                    enlargedImage.style.opacity = 1; // Ensure fully visible
                }, 100); // Match this duration with your CSS transition duration
                
                // enlargedImage.classList.add('fadeIn'); // Remove hidden and fading
                // imageCaption.classList.add('fadeIn'); // Show and un-fade
                // enlargedImage.classList.remove('hidden', 'fading'); // Remove hidden and fading
                // imageCaption.classList.remove('hidden', 'fading'); // Show and un-fade
            };

            enlargedImage.onerror = () => {
                loadingSpinner.classList.add('hidden');
                enlargedImage.classList.remove('hidden', 'fading');
                imageCaption.classList.remove('hidden', 'fading');
                imageCaption.textContent = `Error loading image: ${image.Caption || 'No caption'}`;
                console.error("Failed to load image:", image.Photo);
            };
        }, FADE_DURATION); // Wait for fade-out to complete before changing image source

        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Function to hide the lightbox (same as before)
    function hideLightbox() {
        stopSlideshow();
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';

        enlargedImage.onload = null;
        enlargedImage.onerror = null;
        currentImageIndexInFilteredList = -1;
        enlargedImage.classList.remove('fading', 'hidden');
        imageCaption.classList.remove('fading', 'hidden');
        loadingSpinner.classList.add('hidden'); // Ensure spinner is hidden
    }

    // NEW FUNCTION: Navigate to the next image in the filtered list
    function showNextImage() {
        if (filteredImageData.length === 0) return; // No images to navigate

        currentImageIndexInFilteredList++;
        if (currentImageIndexInFilteredList >= filteredImageData.length) {
            currentImageIndexInFilteredList = 0; // Loop to the first image
        }
        showLightbox(currentImageIndexInFilteredList);
    }

    // NEW FUNCTION: Navigate to the previous image in the filtered list
    function showPrevImage() {
        if (filteredImageData.length === 0) return; // No images to navigate

        currentImageIndexInFilteredList--;
        if (currentImageIndexInFilteredList < 0) {
            currentImageIndexInFilteredList = filteredImageData.length - 1; // Loop to the last image
        }
        showLightbox(currentImageIndexInFilteredList);
    }

    // NEW EVENT LISTENERS for navigation buttons
    nextButton.addEventListener('click', showNextImage);
    prevButton.addEventListener('click', showPrevImage);


    // NEW FUNCTION: Start the slideshow
    function startSlideshow() {
        viewMode = 'slideshow';
        openFullscreen();
        if (filteredImageData.length === 0) {
            alert("No images to display for slideshow!");
            return;
        }
        if (slideshowInterval) { // If already running, stop it first
            stopSlideshow();
        }

        // If lightbox is not already open, open it to the first image
        if (lightbox.classList.contains('hidden')) {
            currentImageIndexInFilteredList = latestImageViewed; // Start from the last viewed image
            showLightbox(currentImageIndexInFilteredList);
        }

        slideshowButton.textContent = "Stop Slideshow"; // Update button text
        lightboxSlideshowButton.innerHTML = '&#124;&#124;'; // Update lightbox button text
        //&#124;
        slideshowButton.classList.add('active-slideshow'); // Optional: Add a class for active state styling
        lightboxSlideshowButton.classList.add('active-slideshow');

        slideshowInterval = setInterval(() => {
            showNextImage();
        }, SLIDESHOW_DELAY);
    }

    // NEW FUNCTION: Stop the slideshow
    function stopSlideshow() {
        viewMode = 'manual';
        closeFullscreen();
        if (slideshowInterval) {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
            slideshowButton.textContent = "Start Slideshow"; // Reset button text
            lightboxSlideshowButton.innerHTML = '&raquo;';
            slideshowButton.classList.remove('active-slideshow'); // Remove active state class
            lightboxSlideshowButton.classList.remove('active-slideshow');
        }
    }

    // NEW EVENT LISTENER for slideshow button
    slideshowButton.addEventListener('click', () => {
        if (slideshowInterval) {
            stopSlideshow();
            
        } else {
            startSlideshow();
        }
    });

    //lightboxSlideshowButton
    lightboxSlideshowButton.addEventListener('click', () => {
        if (slideshowInterval) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    });


    // Event listeners for closing the lightbox (same as before)
    
    enlargedImage.addEventListener('click', hideLightbox);
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target === enlargedImage || event.target === imageCaption) {
            hideLightbox();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !lightbox.classList.contains('hidden')) {
            hideLightbox();
        } else if (event.key === 'ArrowRight' && !lightbox.classList.contains('hidden')) {
            stopSlideshow(); // Stop slideshow if manually navigating
            showNextImage();
        } else if (event.key === 'ArrowLeft' && !lightbox.classList.contains('hidden')) {
            stopSlideshow(); // Stop slideshow if manually navigating
            showPrevImage();
        }
    });

    // Initial fetch of image data when the page loads
    fetchImageData();
});