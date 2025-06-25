document.addEventListener('DOMContentLoaded', () => {
    const thumbnailView = document.getElementById('thumbnail-view');
    const lightbox = document.getElementById('lightbox');
    const loadingSpinner = document.getElementById('loading-spinner');
    const enlargedImage = document.getElementById('enlarged-image');
    const imageCaption = document.getElementById('image-caption');
    const closeButton = document.querySelector('.close-button');

    const searchInput = document.getElementById('search-input');
    const clearSearchButton = document.getElementById('clear-search');

    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    const slideshowButton = document.getElementById('slideshow-button');

    // **IMPORTANT: Replace this with your actual published CSV link**
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vTFFIiRQNWYxq1hNvdK6H1LVydbBvUUJ98HmWuohgqksd2c062otJl7fEnUmYbTTXxsZYyOEL1g_KlC/pub?output=csv';

    let imageData = [];
    let currentThumbnails = [];
    let filteredImageData = [];
    let currentImageIndexInFilteredList = -1;

    // NEW: Slideshow variables
    let slideshowInterval = null; // Holds the interval ID
    const SLIDESHOW_DELAY = 3000; // 3 seconds per image
    const FADE_DURATION = 500; // 0.5 seconds for fade effect (matches CSS transition)


    // Function to fetch and parse CSV data
    async function fetchImageData() {
        try {
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            imageData = parseCsvToJSON(csvText);
            filteredImageData = [...imageData];
            renderThumbnails(imageData);
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
            photoID = imageURL.split("/d/")[1].split('/')[0]; // Ensure only the ID is captured
        }
        return photoID;
    }

    function regExMatch(str) {
        const regex = /^([^,]+)(?:,([^,]+))?(?:,([^,]+))?(?:,(.*))?$/g;
        let m;
        let groups = [];
        while ((m = regex.exec(str.trim())) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            m.forEach((match, groupIndex) => {
                if (groupIndex > 0) { // Only capture actual groups, not the full match (group 0)
                    groups.push(match);
                }
            });
        }
        return groups;
    }

    function parseCsvToJSON(csv) {
        const lines = csv.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            let regExGroups = regExMatch(lines[i]);

            // Ensure regExGroups has at least enough elements for Photo and Caption
            // Assuming 'Photo' is the 3rd column (index 2) and 'Caption' is the 4th (index 3)
            // based on your previous regex which captures up to 4 groups.
            // If the structure changes, you'll need to adjust these indices or headers.
            if (regExGroups.length < 4) { // Needs at least 4 groups if Photo is 3rd and Caption is 4th
                 console.warn(`Skipping row ${i+1} due to insufficient columns after regex match.`);
                 continue;
            }

            const item = {};
            // Assuming header mapping: headers[0] -> Timestamp, headers[1] -> Email Address, headers[2] -> Photo, headers[3] -> Caption
            // Adjust these indices based on your CSV's actual column order and desired data.
            item[headers[2]] = regExGroups[2]; // Photo column
            item[headers[3]] = regExGroups[3]; // Caption column (can contain commas)


            // Manual cleanup for values if regex leaves extra commas or quotes
            for (const key in item) {
                if (typeof item[key] === 'string') {
                    item[key] = item[key].trim();
                    if (item[key].startsWith('"') && item[key].endsWith('"')) {
                        item[key] = item[key].substring(1, item[key].length - 1); // Remove quotes
                    }
                    if (item[key].endsWith(',')) {
                        item[key] = item[key].substring(0, item[key].length - 1); // Remove trailing comma
                    }
                }
            }
            data.push(item);
        }
        return data;
    }


    // Function to render thumbnails (modified to store references)
    function renderThumbnails(images) {
        thumbnailView.innerHTML = '';
        currentThumbnails = [];

        images.forEach((image, index) => {
            const thumbDiv = document.createElement('div');
            thumbDiv.classList.add('thumbnail-item');
            thumbDiv.dataset.originalIndex = index;
            // Use image.Caption here, assuming 'Caption' is the header from your CSV
            thumbDiv.dataset.caption = image.Caption ? image.Caption.toLowerCase() : '';

            const tooltip = document.createElement('span');
            tooltip.setAttribute('class', 'tooltiptext');
            tooltip.textContent = `${index+2}. ${image.Caption || 'No caption'}`; // Use image.Caption

            const img = document.createElement('img');
            let photoID = extractID(image.Photo); // Use image.Photo
            img.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s300`;
            img.alt = image.Caption; // Use image.Caption

            thumbDiv.appendChild(img);
            thumbDiv.appendChild(tooltip);
            thumbnailView.appendChild(thumbDiv);

            thumbDiv.addEventListener('click', () => {
                stopSlideshow(); // Stop slideshow if user clicks a thumbnail
                const originalIndexClicked = parseInt(thumbDiv.dataset.originalIndex);
                const indexInFiltered = filteredImageData.findIndex(img => imageData.indexOf(img) === originalIndexClicked);
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
        filteredImageData = [];

        currentThumbnails.forEach(thumbDiv => {
            const caption = thumbDiv.dataset.caption;
            const originalIndex = parseInt(thumbDiv.dataset.originalIndex);

            if (caption.includes(searchTerm) || searchTerm === '') {
                thumbDiv.classList.remove('hidden-by-search');
                filteredImageData.push(imageData[originalIndex]);
            } else {
                thumbDiv.classList.add('hidden-by-search');
            }
        });
        // If slideshow is active and filtering reduces the list, stop it.
        // Or if the current image is filtered out, slideshow should ideally restart from 0 or stop.
        // For simplicity, we'll stop it.
        stopSlideshow();
    }

    // NEW EVENT LISTENERS for search bar
    searchInput.addEventListener('input', filterThumbnails);

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        filterThumbnails();
        searchInput.focus();
    });

    // Function to show the lightbox with loading spinner (modified for fade effect)
    function showLightbox(indexInFilteredList) {
        if (indexInFilteredList < 0 || indexInFilteredList >= filteredImageData.length) {
            console.error("Invalid index for lightbox:", indexInFilteredList);
            return;
        }

        currentImageIndexInFilteredList = indexInFilteredList;
        const image = filteredImageData[currentImageIndexInFilteredList];

        // Hide old image/caption and show spinner immediately for fade-out
        enlargedImage.classList.add('fading'); // Start fade-out
        imageCaption.classList.add('fading');
        loadingSpinner.classList.remove('hidden');
        enlargedImage.classList.add('hidden'); // Hide display to prevent showing old image after fade-out
        imageCaption.classList.add('hidden');


        // Update UI to show/hide navigation buttons if only one image in filtered list
        if (filteredImageData.length <= 1) {
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        } else {
            prevButton.style.display = 'block';
            nextButton.style.display = 'block';
        }

        // Delay updating src to allow fade-out to complete
        setTimeout(() => {
            let photoID = extractID(image.Photo);
            let caption = `${currentImageIndexInFilteredList+1}. ${image.Caption || 'No caption'}`; // Corrected index for display

            enlargedImage.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s1200`;
            enlargedImage.alt = caption;
            imageCaption.textContent = caption;

            enlargedImage.onload = () => {
                loadingSpinner.classList.add('hidden');
                enlargedImage.classList.remove('hidden', 'fading'); // Remove hidden and fading
                imageCaption.classList.remove('hidden', 'fading'); // Show and un-fade
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

    // Function to hide the lightbox (modified to stop slideshow)
    function hideLightbox() {
        stopSlideshow(); // Stop slideshow when lightbox is closed
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';

        enlargedImage.onload = null;
        enlargedImage.onerror = null;
        currentImageIndexInFilteredList = -1;
        // Ensure image/caption are not left in fading state if closed mid-transition
        enlargedImage.classList.remove('fading', 'hidden');
        imageCaption.classList.remove('fading', 'hidden');
        loadingSpinner.classList.add('hidden'); // Ensure spinner is hidden
    }

    function showNextImage() {
        if (filteredImageData.length === 0) return;
        currentImageIndexInFilteredList++;
        if (currentImageIndexInFilteredList >= filteredImageData.length) {
            currentImageIndexInFilteredList = 0;
        }
        showLightbox(currentImageIndexInFilteredList);
    }

    function showPrevImage() {
        if (filteredImageData.length === 0) return;
        currentImageIndexInFilteredList--;
        if (currentImageIndexInFilteredList < 0) {
            currentImageIndexInFilteredList = filteredImageData.length - 1;
        }
        showLightbox(currentImageIndexInFilteredList);
    }

    // NEW FUNCTION: Start the slideshow
    function startSlideshow() {
        if (filteredImageData.length === 0) {
            alert("No images to display for slideshow!");
            return;
        }
        if (slideshowInterval) { // If already running, stop it first
            stopSlideshow();
        }

        // If lightbox is not already open, open it to the first image
        if (lightbox.classList.contains('hidden')) {
            currentImageIndexInFilteredList = 0; // Start from the first image
            showLightbox(currentImageIndexInFilteredList);
        }

        slideshowButton.textContent = "Stop Slideshow"; // Update button text
        slideshowButton.classList.add('active-slideshow'); // Optional: Add a class for active state styling

        slideshowInterval = setInterval(() => {
            showNextImage();
        }, SLIDESHOW_DELAY);
    }

    // NEW FUNCTION: Stop the slideshow
    function stopSlideshow() {
        if (slideshowInterval) {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
            slideshowButton.textContent = "Start Slideshow"; // Reset button text
            slideshowButton.classList.remove('active-slideshow'); // Remove active state class
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

    // EVENT LISTENERS for closing the lightbox (modified to stop slideshow)
    closeButton.addEventListener('click', hideLightbox);
    // Modified: Clicking anywhere on the lightbox background (including the image/caption)
    // will now stop the slideshow and close the lightbox.
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