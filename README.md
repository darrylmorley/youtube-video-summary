# YouTube Video Transcript to ChatGPT Extension

This Chrome extension allows users to extract transcripts from YouTube videos and send them directly to ChatGPT for summarization. By clicking the extension icon while viewing a YouTube video, the extension fetches the transcript (if available) and sends it to a ChatGPT tab, where a summary is generated.

## Features

- Automatically extracts the transcript of YouTube videos (if available).
- Sends the transcript and video details (title, author) to ChatGPT for summarization.
- Automatically refreshes the page before extracting data to ensure the latest video information is used.
- Summarizes the transcript in bullet points, depending on the length of the transcript.

## Installation

- Clone this repository or download it as a ZIP file and extract it to a folder on your local machine.

```bash
git clone git@github.com:darrylmorley/youtube-video-summary-chatgpt.git
```

- Open Chrome and go to chrome://extensions/.
- Enable Developer mode using the toggle in the top-right corner.
- Click on Load unpacked and select the folder where this extension's files are located.

The extension should now be added to Chrome, and you'll see the extension icon in your browser.

## Usage

- Navigate to a YouTube video page that includes captions.
- Click the extension icon to trigger the transcript extraction process. The page will reload to ensure the latest data is available.
- After the page reloads, the extension will extract the transcript and send it to ChatGPT for summarization.
- A new tab will open with ChatGPT, and the transcript will be injected into the ChatGPT input field along with a prompt to summarize it.
- ChatGPT will generate a summary of the video in bullet points based on the length of the transcript.
