# Privacy practices tab

Copy these answers into the Chrome Web Store dashboard → **Privacy practices**. The dashboard is in English, so the answers are in English.

## Single purpose

Adds a "Save as PNG" item to the image context menu that converts the selected image (WebP or any other format Chrome can display) to a lossless PNG and saves it to the user's download folder.

## Permission justifications

**contextMenus**
Adds the "Save as PNG" item to the right-click menu of images. This is the only way to use the extension.

**downloads**
Saves the converted PNG file to the user's download folder, using Chrome's normal download settings.

**offscreen**
The image is decoded and encoded as PNG in an offscreen document. A Manifest V3 service worker has no DOM, WebGL canvas, worker pool or URL.createObjectURL, and all of these are needed for the conversion and to hand the file to chrome.downloads.

**scripting**
Fallback only: when the extension cannot fetch an image itself (blob: URLs, or images only available with the page's own session), it injects a small function into the page the user right-clicked. The function fetches that one image and returns its bytes. It does not read or change anything else on the page.

**notifications**
Shows an error notification if an image cannot be converted or saved (for example the server returned 403). No other notifications are shown.

**declarativeNetRequestWithHostAccess**
Many image CDNs refuse requests without the Referer of the page showing the image (hotlink protection). For the single image fetch the user started, the extension adds a temporary session rule. The rule sets the same Referer the page itself would send (only the page origin for cross-site images), applies only to requests made by the extension itself, and is removed right after the fetch.

**Host permission (<all_urls>)**
The user can right-click an image on any website, and images are often served from a different domain (CDN) than the page. The extension needs host access to download the bytes of the exact image the user clicked, regardless of CORS. Nothing is fetched until the user picks "Save as PNG", and only that one image is fetched.

## Remote code

**No, I am not using remote code.** All JavaScript is in the package; nothing is loaded or evaluated from the network.

## Data usage

Tick **none** of the data categories. The extension does not collect or transmit any user data. Images are processed locally and saved only to the user's own disk.

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy policy URL

https://github.com/P4ULdmit/save-webp-as-png/blob/main/store/privacy-policy.md
