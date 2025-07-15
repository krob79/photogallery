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
    const downloadButton = document.getElementById('download-button');
    downloadButton.addEventListener('click', downloadImage);

    const navButtons = document.getElementById('nav-buttons');

    // **IMPORTANT: Replace this with your actual published CSV link**
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFFIiRQNWYxq1hNvdK6H1LVydbBvUUJ98HmWuohgqksd2c062otJl7fEnUmYbTTXxsZYyOEL1g_KlC/pub?output=csv';
    // const GOOGLE_SHEET_CSV_URL = '../localPics.csv';

    const elem = document.documentElement;

    let viewMode = 'manual'; // 'manual' or 'slideshow'
    let imageData = []; // Stores all fetched image data
    let currentThumbnails = []; // Stores references to the actual thumbnail DOM elements
    let filteredThumbnails = []; // Stores references to the currently filtered thumbnails
    let filteredImageData = []; // Stores the currently visible images (based on search)
    let currentImageIndexInFilteredList = -1; // Index of the currently viewed image within filteredImageData
    let latestImageViewed = 0;
    let maxItemsPerPage = 30; // Maximum number of items per page

    // NEW: Slideshow variables
    let slideshowInterval = null; // Holds the interval ID
    const SLIDESHOW_DELAY = 6000; // 3 seconds per image
    const FADE_DURATION = 500; // 0.5 seconds for fade effect (matches CSS transition)

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
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        } catch (err) {
            console.warn("Could not exit fullscreen mode.");
        }

    }

    function downloadImage() {
        // Get the current image source
        const currentImageSrc = enlargedImage.src;
        if (!currentImageSrc) {
            console.error("No image to download.");
            return;
        }

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = currentImageSrc;
        link.target = '_blank'; // Open in new tab

        let filename = imageCaption.textContent.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase(); // Sanitize filename
        link.download = filename || 'downloaded_image'; // Use caption as filename or default

        // Append to body, click and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    }



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
            // console.log("Fetch image data:", imageData); // Log the fetched data for debugging
            renderThumbnails(imageData); // Initial render of all thumbnails
            checkPageParam();
            showPage(currentThumbnails, 0); // Show the first page of thumbnails

        } catch (error) {
            console.error("Could not fetch or parse image data from Google Sheet:", error);
            thumbnailView.innerHTML = '<p>Error loading images from Google Sheet. Please check the URL and sharing settings.</p>';
        }
    }

    function createImgSrc(imageURL, size) {
        let photoID;
        let imgSrc;
        //if imageURL contains a reference to "id", or "/d/" in the path, reformat the URL and extract the id value
        //otherwise, just send the imageURL parameter through as-is
        if (imageURL.includes("id=")) {

            photoID = imageURL.split("id=")[1];
            // imgSrc = `https://drive.google.com/thumbnail?id=${photoID}&sz=${size}`
            imgSrc = `https://lh3.googleusercontent.com/d/${photoID}=w${size}`;
            // <img src="https://lh3.googleusercontent.com/d/1ATAxpQ7puldruGOvrRclCmKF7d9s9qWI=w600-h600" alt=""></img>


        } else if (imageURL.includes("/d/")) {

            photoID = imageURL.split("/d/")[1];
            // imgSrc = `https://drive.google.com/thumbnail?id=${photoID}&sz=${size}`;
            imgSrc = `https://lh3.googleusercontent.com/d/${photoID}=w${size}`;

        } else {
            imgSrc = imageURL;
        }
        return imgSrc;

    }

    //check to see if the URL has a 'view' parameter, and if so, show that image
    //this allows for copying/pasting a link to a specific image in the lightbox
    //e.g. https://yourdomain.com/yourpage.html?view=2
    function checkPageParam() {
        const urlSearchParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlSearchParams.entries());
        //console.log("URL Parameters:", params); // Log URL parameters for debugging
        let adjustedNumberForSpreadsheet;
        if (params['view']) {
            adjustedNumberForSpreadsheet = parseInt(params['view']) - 2; // Adjust for 0-based index
            showLightbox(adjustedNumberForSpreadsheet);
        }
    }


    function regExMatch(str) {
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
        // console.log(`Headers found: ${headers}`); // Log headers for debugging
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            // console.log(`Processing row ${i+1}: ${lines[i]}`); // Log each row being processed

            let regExGroups = regExMatch(lines[i]);

            const item = {};
            for (let j = 0; j < regExGroups.length; j++) {
                // Trim whitespace and handle potential quotes in values
                let value = regExGroups[j + 1];
                if (typeof value == "string") {
                    if (value.endsWith(',')) {
                        value = value.substring(0, value.length - 1); // Remove comma at the end
                    }
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1); // Remove quotes
                    }

                }
                item[headers[j]] = value;
                item["id"] = i + 1; // Add an ID field based on the row number
            }
            // console.log(`Parsed item: ${item}`); // Log the parsed item for debugging
            data.push(item);
        }
        console.log(`----parseCSVtoJSON: `);
        return data;
    }

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
            tooltip.textContent = `${image.id}. ${image.Caption}` || 'No caption';


            const img = document.createElement('img');
            //let photoID = createImgSrc(image.Photo, 300);
            //img.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s300`;
            img.src = createImgSrc(image.Photo, 300);
            img.alt = image.Caption;
            // console.log(index, image);

            thumbDiv.appendChild(img);
            thumbDiv.appendChild(tooltip);
            thumbnailView.appendChild(thumbDiv);

            // When a thumbnail is clicked, find its index within the *currently filtered* list
            thumbDiv.addEventListener('click', () => {
                //grab the original index from the dataset
                const originalIndexClicked = parseInt(thumbDiv.dataset.originalIndex);
                //update latestImageViewed to be this index - is used for slideshow start point to resume from last img viewed
                latestImageViewed = originalIndexClicked;
                // Find the index of this image in the filtered list
                const indexInFiltered = filteredImageData.findIndex(img => imageData.indexOf(img) === originalIndexClicked);
                console.log(`Thumbnail clicked - Original 0-based Index: ${originalIndexClicked}, Filtered 0-based Index: ${indexInFiltered}`);
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
        filteredThumbnails = [];

        currentThumbnails.forEach(thumbDiv => {
            const caption = thumbDiv.dataset.caption;
            const originalIndex = parseInt(thumbDiv.dataset.originalIndex); // Get original index

            if (caption.includes(searchTerm) || searchTerm === '') {
                thumbDiv.classList.remove('hidden-by-search');
                filteredImageData.push(imageData[originalIndex]); // Add to filtered data
                filteredThumbnails.push(thumbDiv); // Store the reference to the thumbnail
            } else {
                thumbDiv.classList.add('hidden-by-search');
            }
        });

        appendPageLinks(filteredThumbnails, maxItemsPerPage);
    }

    // NEW EVENT LISTENERS for search bar
    searchInput.addEventListener('input', () => {
        filterThumbnails();
        // Reset to the first page after filtering
        showPage(filteredThumbnails, 0);
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        filterThumbnails();
        searchInput.focus();
        showPage(filteredThumbnails, 0);
    });

    // Function to show the lightbox with loading spinner (modified to use filteredImageData)
    //Param index is the index in the filteredImageData array, which could be everything, or just a subset if filtered
    function showLightbox(index) {
        console.log(`Showing lightbox for index: ${index}`);
        // if (index < 0 || index >= filteredImageData.length) {
        //     console.error("Invalid index for lightbox:", index);
        //     return;
        // }

        // console.log(filteredImageData);

        currentImageIndexInFilteredList = index;



        //filter the whole imageData array and find the index of the image with this id
        //let imgToView = imageData.findIndex(img => img.id === imageData[index]);
        console.log(`---showLightBox called for image ID: ${filteredImageData[index].id} at filtered index: ${index} ---`);

        // const image = imageData[index]; 
        const image = filteredImageData[index];

        //show spinner and hide nav buttons
        loadingSpinner.classList.remove('hidden');
        navButtons.classList.add('hidden');
        //hide whatever image/caption is currently showing
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
            //set image opacity to 0 to prepare for fade-in
            enlargedImage.style.opacity = 0;
            imageCaption.style.opacity = 0;
            // let photoID = createImgSrc(image.Photo, 1200);
            let caption = `${image.id}. ${image.Caption || 'No caption'}`; // Adjusted index for reference to CSV row number

            // enlargedImage.src = `https://drive.google.com/thumbnail?id=${photoID}&sz=s1200`;
            enlargedImage.src = createImgSrc(image.Photo, 1200);
            enlargedImage.alt = caption;
            imageCaption.textContent = caption;

            loadingSpinner.classList.add('hidden');

            enlargedImage.onload = () => {

                enlargedImage.classList.remove('hidden'); // Remove hidden and fading
                imageCaption.classList.remove('hidden'); // Show and un-fade
                if (viewMode === 'manual') {
                    navButtons.classList.remove('hidden');
                }

                setTimeout(() => {
                    enlargedImage.style.opacity = 1; // Ensure fully visible
                    imageCaption.style.opacity = 1;
                }, 100); // Match this duration with your CSS transition duration

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
        if (viewMode === 'slideshow') {
            stopSlideshow();
        }
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
        console.log("NEXT:", filteredImageData[currentImageIndexInFilteredList].id);
        // console.log(filteredImageData[currentImageIndexInFilteredList].id);
        showLightbox(currentImageIndexInFilteredList);
    }

    // NEW FUNCTION: Navigate to the previous image in the filtered list
    function showPrevImage() {
        if (filteredImageData.length === 0) return; // No images to navigate

        currentImageIndexInFilteredList--;
        if (currentImageIndexInFilteredList < 0) {
            currentImageIndexInFilteredList = filteredImageData.length - 1; // Loop to the last image
        }
        console.log("PREV:", filteredImageData[currentImageIndexInFilteredList].id);
        // console.log(filteredImageData[currentImageIndexInFilteredList].id);
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

    function shuffle(array) {
        let newShuffledArray = [...array]; // Create a shallow copy to avoid mutating the original array
        var m = array.length, t, i;

        // While there remain elements to shuffle…
        while (m) {

            // Pick a remaining element…
            i = Math.floor(Math.random() * m--);

            // And swap it with the current element.
            t = newShuffledArray[m];
            newShuffledArray[m] = newShuffledArray[i];
            newShuffledArray[i] = t;
        }

        console.log("Shuffled array:", newShuffledArray);

        return newShuffledArray;
    }


    // Event listeners for closing the lightbox (same as before)

    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target === enlargedImage) {
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



    function showPage(items, pageNum) {
        //organize pages
        let length = items.length;
        let pagesNeeded = Math.ceil(length / maxItemsPerPage);
        appendPageLinks(items, maxItemsPerPage);

        //the count for items visible should be set to 0 by default, but keep the 'none found' message hidden
        let itemsVisible = 0;
        // currentPage = pageNum;



        //show only items from the array passed in
        for (let i = 0; i < items.length; i++) {
            /*
            if the current student's index is greater than or equal to the index referenced in the pageIndexes array OR 
            the current student's index is less than the pageIndex + maxitemsPerPage (which would be the first index of 
            the next page), show the student. Otherwise, hide the student.
            */
            if (items.indexOf(items[i]) >= pageIndexes[pageNum] && items.indexOf(items[i]) < (pageIndexes[pageNum] + maxItemsPerPage)) {

                items[i].classList.remove('hidden-by-search');

                //count how many items are visible
                itemsVisible++;
            } else {
                items[i].classList.add('hidden-by-search');
            }
        }
        if (itemsVisible > 0) {
            //highlight the button that corresponds with the page you're on
            let linkList = document.querySelectorAll('.pagination');
            //run procedure for both top and bottom pagination
            let links = linkList[0].querySelectorAll('li > a');
            let links2 = linkList[1].querySelectorAll('li > a');
            for (let i = 0; i < links.length; i++) {
                if (i == pageNum) {
                    links[i].style.border = "1px solid firebrick";
                    links2[i].style.border = "1px solid firebrick";
                } else {
                    links[i].style.border = "";
                    links2[i].style.border = "";
                }
            }
        }
    }

    let pageIndexes = [];
    function appendPageLinks(itemList, maxPerPage) {
        //checking if ul pagination links already exist, removing them if they do
        var linkCheck = document.getElementsByClassName('pagination');
        var pageElement = document.getElementById('page-links');
        var pageElement2 = document.getElementById('page-links2');
        if (linkCheck.length > 0) {
            pageElement.removeChild(pageLinksElement);
            pageElement2.removeChild(pageLinksElement2);
        }
        //create new ul pagination element
        pageLinksElement = document.createElement('ul');
        pageLinksElement.className = 'pagination';
        pageLinksElement2 = document.createElement('ul');
        pageLinksElement2.className = 'pagination';
        let pageIndex = 0;

        let pagesNeeded = Math.ceil(itemList.length / maxPerPage);
        console.log(`Total items: ${itemList.length}, Max per page: ${maxPerPage}, Pages needed: ${pagesNeeded}`);
        for (let i = 0; i < pagesNeeded; i++) {
            //add the first index from each page to the pageIndexes array, then increment by max 
            pageIndexes.push(pageIndex);
            pageIndex += maxPerPage;
            let pageLink = document.createElement('li');
            let pageLink2 = document.createElement('li');
            pageLink.innerHTML = `<a>${i + 1}</a>`;
            pageLink2.innerHTML = `<a>${i + 1}</a>`;
            // pageLink.addEventListener("click", (e) => { console.log("page link!"); });
            pageLink.addEventListener("click", (e) => { showPage(currentThumbnails, i); });
            pageLinksElement.appendChild(pageLink);
            pageLink2.addEventListener("click", (e) => { showPage(currentThumbnails, i); });
            pageLinksElement2.appendChild(pageLink2);
        }
        // console.log(`Page indexes: ${pageIndexes}`);
        pageElement.appendChild(pageLinksElement);
        pageElement2.appendChild(pageLinksElement2);
    }



    // Initial fetch of image data when the page loads
    fetchImageData();


});