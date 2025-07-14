# Google Drive Photo Gallery

A small experiment born out of necessity for a family reunion.

## Objective: 
- Create a slideshow of family photos, each with a caption.

## Challenges:
- Getting various family members in various states and various competencies with technology to send digital photos
- Getting those same family members to provide appropriately descriptive labels so that everyone can understand the subjects in the photo
  (Example: "Gramps with the kids at the old house" vs. "Tom Espinosa at his house with grandkids Megan Byrne, Amy Byrne, and Molly Byrne")
- I want to avoid managing a bunch of photos and having to repeatedly reply back to senders for clarity about the photos they sent.
- I want to avoid spending a lot of time making a slideshow of 100+ pictures.

## Attempted Solution:
- Create a Google Form, where users are prompted to upload a single photo, then type out a mandatory caption for that photo (good examples and bad examples are provided)
- Responses from the Google Form (image and caption) are stored in a Google Sheet, formatted as a CSV
- The Google Drive for photos and Google Sheet are made public
- Info from the CSV is loaded into a dynamic gallery on a webpage, which can browsed one-by-one in a lightbox view, or automated through a "slideshow mode"
