const GEMINI_API_KEY = "Your Gemini API goes here";

document.getElementById("scrapeBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const progress = document.getElementById("progress");
  const bar = document.getElementById("bar");

  function showProgress(percent) {
    progress.style.display = "block";
    bar.style.width = percent + "%";
  }

  function showStatus(text, color = "white") {
    status.textContent = text;
    status.style.color = color;
  }

  showStatus("Finding text..");
  showProgress(10);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const containers = document.querySelectorAll("#book-content");
        if (!containers || containers.length === 0) return [];

        let collected = [];
        containers.forEach((container, idx) => {
          const elements = Array.from(container.querySelectorAll("p, div, span"));
          elements.forEach((el) => {
            if (el.innerText && el.innerText.trim().length > 0) {
              collected.push({ block: idx, text: el.innerText });
            }
          });
        });
        return collected;
      },
    });

    const textItems = results[0]?.result;
    if (!textItems || textItems.length === 0) {
      showStatus("No text detected.", "red");
      showProgress(0);
      return;
    }

    showStatus("Translating...");
    showProgress(20);

    const separator = "\n---SEPARATOR---\n";

    //This is to divide text into chunks, in order to not overload the model (I was using gemini flash 2.0)

    function chunkArrayBySize(arr, maxLen) {
      let chunks = [];
      let temp = [];
      let tempLen = 0;

      arr.forEach((item) => {
        if (tempLen + item.text.length > maxLen) {
          chunks.push(temp);
          temp = [];
          tempLen = 0;
        }
        temp.push(item);
        tempLen += item.text.length;
      });
      if (temp.length > 0) chunks.push(temp);
      return chunks;
    }

    const chunks = chunkArrayBySize(textItems, 2000);
    let completed = 0;
    let translatedItems = [];

    for (let i = 0; i < chunks.length; i++) {
      showStatus(`Translating batch number: ${i + 1}/${chunks.length}...`);

      const combinedText = chunks[i].map((item) => item.text).join(separator);
      const result = await translateWithGemini(combinedText);

      if (!result) {
        showStatus(`Batch ${i + 1} failed.`, "red");
        return;
      }

      const parts = result.split(separator);
      translatedItems.push(...parts);

      completed++;
      const percent = 20 + Math.floor((completed / chunks.length) * 60);
      showProgress(percent);

      await delay(1000);
    }

    showStatus("Updating content...");
    showProgress(90);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [textItems, translatedItems],
      func: (originalItems, translatedTexts) => {
        const containers = document.querySelectorAll("#book-content");
        if (!containers) return;

        let pointer = 0;
        containers.forEach((container) => {
          const elements = Array.from(container.querySelectorAll("p, div, span"))
            .filter((el) => el.innerText && el.innerText.trim().length > 0);

          elements.forEach((el) => {
            if (translatedTexts[pointer]) {
              el.innerText = translatedTexts[pointer];
            }
            pointer++;
          });
        });
      },
    });

    showStatus("Translated Successfully", "green");
    showProgress(100);
  } catch (err) {
    console.error(err);
    showStatus("Uncaught error?", "red");
    showProgress(0);
  }
});

//Translate (communicate with the model here)
async function translateWithGemini(inputText, retries = 3, delayMs = 3000) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          {
            text: `Translate the following article into YOUR CHOICE OF LANGUAGE, try to make it the same as the original article.
only changes the text, do not change or remove HTML tag.
Each chunk is seperate by: ---SEPARATOR---\n\n${inputText}`,
          },
        ],
      },
    ],
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API error:", errorData);

        if (response.status === 503 && attempt < retries) {
          console.log(`Model overloaded, try again in ${delayMs / 1000}s... (attempts number ${attempt})`);
          await delay(delayMs * attempt);
          continue;
        }
        return null;
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      console.error("Gemini API fetch error:", err);
      if (attempt < retries) {
        await delay(delayMs * attempt);
        continue;
      }
      return null;
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
