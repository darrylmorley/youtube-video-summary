chrome.action.onClicked.addListener(async (tab) => {
  console.log("Extension icon clicked!");

  if (tab.url.includes("youtube.com/watch")) {
    // Reload the page to ensure the latest video data is loaded
    chrome.tabs.reload(tab.id, {}, () => {
      console.log("Page reloaded.");

      // Wait for the reload to complete before injecting the script
      chrome.tabs.onUpdated.addListener(function onTabUpdated(
        tabId,
        changeInfo
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          console.log("Page reload complete, injecting script...");
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractAndSendTranscript,
          });

          // Remove listener after script injection
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
        }
      });
    });
  } else {
    console.error("This extension only works on YouTube video pages.");
  }
});

// This function will be injected into the YouTube page
function extractAndSendTranscript() {
  // Function to extract transcript and video info
  async function getTranscriptAndSendToChatGPT() {
    let config = null;
    let transcript = null;
    let videoData = null;
    let captions = null;
    let title = null;
    let author = null;

    config = await getConfigRetry();
    if (!config) {
      alert("Could not fetch the transcript configuration.");
      return;
    }

    console.log("Config: ", config);

    captions = config?.captions;
    title = config?.videoDetails?.title;
    author = config?.videoDetails?.author;

    if (!captions || captions.length === 0) {
      alert("No transcript available for this video.");
      return;
    }

    transcript = await fetchTranscript(captions);
    if (!transcript) {
      alert("Could not fetch the transcript.");
      return;
    }

    // Video data extracted
    videoData = {
      title: title,
      author: author,
      transcript: transcript,
    };

    console.log("Video data: ", videoData);

    // Send the video data back to the background script
    chrome.runtime.sendMessage({
      action: "openNewTab",
      videoData: videoData,
    });
  }

  // Retry mechanism to fetch the config with a timeout
  async function getConfigRetry(maxRetries = 5, delay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const config = await getConfig();
      if (config) {
        return config; // Return the config if it's found
      }

      console.log(`Retrying to fetch config... (attempt ${attempt + 1})`);
      await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
      delay *= 2; // Exponential backoff
    }
    return null; // If we reach here, config was not found after retries
  }

  // Helper functions
  async function getConfig() {
    let scripts = null;
    scripts = document.querySelectorAll("script");

    for (let script of scripts) {
      if (script.textContent.includes("ytInitialPlayerResponse")) {
        const match = script.textContent.match(
          /ytInitialPlayerResponse\s*=\s*(\{.+?\});/
        );
        if (match) {
          return JSON.parse(match[1]);
        }
      }
    }
    return null;
  }

  async function fetchTranscript(captions) {
    const track =
      captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
        (track) => track.languageCode === "en"
      );
    if (track) {
      const response = await fetch(track.baseUrl);
      const xml = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "text/xml");
      const texts = Array.from(xmlDoc.getElementsByTagName("text"))
        .map((node) => node.textContent)
        .join(" ");
      return texts;
    }
    return null;
  }

  // Start the extraction process
  getTranscriptAndSendToChatGPT();
}

// Background script handling new tab creation after receiving the message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openNewTab") {
    const videoData = message.videoData;
    console.log("Received video data in listener: ", videoData);

    chrome.tabs.create({ url: "https://chat.openai.com" }, (newTab) => {
      chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, info) {
        if (tabId === newTab.id && info.status === "complete") {
          chrome.scripting.executeScript({
            target: { tabId: newTab.id },
            function: injectTranscriptIntoChat,
            args: [videoData],
          });
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
        }
      });
    });
  }
});

// This function will inject the transcript into ChatGPT
async function injectTranscriptIntoChat(videoData) {
  setTimeout(function () {
    prepareTranscript(videoData);
  }, 1000);

  const prepareTranscript = async function (videoData) {
    let transcript = videoData.transcript;
    if (!transcript) return;
    let bulletQty = transcript.length > 2000 ? 10 : 5;
    let prompt =
      `Summarise the transcript of the video "${videoData.title}" by ${videoData.author} in ${bulletQty} bullet points. The entire transcript is as follows:\n\n` +
      transcript;

    await waitInput();

    sendTranscript({
      prompt,
    });
  };

  const waitInput = function () {
    const textareaSelector = document.querySelector(
      "main form textarea, #prompt-textarea"
    );

    if (textareaSelector) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let attempt = 20;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        const textarea = document.querySelector(
          "main form textarea, #prompt-textarea"
        );
        if (textarea) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  };

  const sendTranscript = function (data) {
    // Select the form inside the main tag
    const form = document.querySelector("main form");

    if (form) {
      // Find the textarea inside the form
      let textarea = form.querySelector("textarea");
      let buttons = form.querySelectorAll("button");

      // If textarea exists and is visible
      if (textarea && textarea.offsetParent !== null) {
        // Checks if textarea is visible
        textarea.value = data.prompt;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        // If no visible textarea, find #prompt-textarea and set its text
        const promptTextarea = form.querySelector("#prompt-textarea");
        if (promptTextarea) {
          promptTextarea.textContent = data.prompt;
        }
      }

      let button;
      // Logic to find the correct button based on the number of buttons present
      if (
        buttons.length >= 2 &&
        form.querySelector('[data-testid="send-button"]')
      ) {
        button = form.querySelector('[data-testid="send-button"]');
      } else if (buttons.length === 3) {
        button = buttons[2];
      } else if (buttons.length === 2) {
        button = buttons[1];
      }

      if (button) {
        // Remove disabled attribute and simulate click
        button.removeAttribute("disabled");
        button.click();

        // Click the send button after a small delay
        setTimeout(() => {
          form.querySelector('[data-testid="send-button"]').click();
        }, 500);

        // Click the button with the specific path in its svg after 4 seconds
        setTimeout(() => {
          Array.from(document.querySelectorAll("main button svg path")).forEach(
            (item) => {
              const d = item.getAttribute("d");
              if (d && d.startsWith("M15.1918 8.90615C15.6381")) {
                item.closest("button").click();
              }
            }
          );
        }, 4000);
      }
    }
  };
}
