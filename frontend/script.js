AWS.config.region = "us-east-2";

// ============================
//   Cognito Authentication
// ============================

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

// NOTE: These are placeholders with actual values in a secure environment.
const userPoolId = "User_Pool_ID"; // User Pool ID
const clientId = "App_Client_ID"; // App Client ID

function calculateSecretHash(username) {
  const secret = "App_Client_Secret"; // App Client Secret
  const message = username + clientId;
  const hash = CryptoJS.HmacSHA256(message, secret);
  return CryptoJS.enc.Base64.stringify(hash);
}

// ============================
//   Sign In Function
// ============================

async function signIn(username, password) {
  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: calculateSecretHash(username),
    },
  };

  try {
    const data = await cognitoIdentityServiceProvider
      .initiateAuth(params)
      .promise();

    if (data.AuthenticationResult) {
      // Store tokens in local storage (Disclaimer - This is not secure for production)
      localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
      localStorage.setItem(
        "accessToken",
        data.AuthenticationResult.AccessToken
      );
      localStorage.setItem(
        "refreshToken",
        data.AuthenticationResult.RefreshToken
      );

      showNotification("Login successful!");

      return data.AuthenticationResult; // Contains tokens
    } else if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      // Show the new password modal
      const newPasswordModal = document.getElementById("new-password-modal");
      const newPasswordForm = document.getElementById("new-password-form");
      const newPasswordInput = document.getElementById("new-password");

      // Clear the password field
      newPasswordInput.value = "";

      // Show the modal
      newPasswordModal.style.display = "flex";

      // Handle form submission
      return new Promise((resolve, reject) => {
        newPasswordForm.onsubmit = async (event) => {
          event.preventDefault(); // Prevent default form submission

          const newPassword = newPasswordInput.value;
          if (!newPassword) {
            showNotification(
              "New password is required to complete login.",
              "error"
            );
            return reject(null);
          }

          // Respond to the new password challenge
          const challengeResponse = {
            ClientId: clientId,
            ChallengeName: "NEW_PASSWORD_REQUIRED",
            Session: data.Session,
            ChallengeResponses: {
              USERNAME: username,
              NEW_PASSWORD: newPassword,
              SECRET_HASH: calculateSecretHash(username),
            },
          };

          try {
            const challengeData = await cognitoIdentityServiceProvider
              .respondToAuthChallenge(challengeResponse)
              .promise();

            if (challengeData.AuthenticationResult) {
              // Store tokens in local storage (Disclaimer - This is not secure for production)
              localStorage.setItem(
                "idToken",
                challengeData.AuthenticationResult.IdToken
              );
              localStorage.setItem(
                "accessToken",
                challengeData.AuthenticationResult.AccessToken
              );
              localStorage.setItem(
                "refreshToken",
                challengeData.AuthenticationResult.RefreshToken
              );

              // Trigger the login success notification
              showNotification("Password updated and login successful!");

              newPasswordModal.style.display = "none"; // Hide the modal
              resolve(challengeData.AuthenticationResult); // Contains tokens
            }
          } catch (challengeError) {
            showNotification(
              "Failed to set new password. Please try again.",
              "error"
            );
            reject(null);
          }
        };
      });
    } else {
      return null;
    }
  } catch (error) {
    showNotification("Login failed. Please try again.", "error");
    return null;
  }
}

// ============================
//   Login and Logout Handlers
// ============================

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-btn").style.display = "block";
  document.getElementById("logout-btn").style.display = "none";
});

document.getElementById("login-btn").addEventListener("click", () => {
  const loginModal = document.getElementById("login-modal");
  loginModal.style.display = "flex"; // Show the login modal
});

document.addEventListener("DOMContentLoaded", () => {
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-btn");

  // Show the login modal when the login button is clicked
  loginButton.addEventListener("click", () => {
    loginModal.style.display = "flex";
  });

  // Handle form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById("username").value; // Use Input Validation on Production
    const password = document.getElementById("password").value; // Use Input Validation on Production

    const tokens = await signIn(username, password);

    if (tokens) {
      loginModal.style.display = "none"; // Hide the modal

      // Update button visibility
      document.getElementById("login-btn").style.display = "none";
      document.getElementById("logout-btn").style.display = "block";

      // Fetch user-specific manga cards
      try {
        await fetchSavedMangaCards();
      } catch (error) {
        alert("Failed to load your manga cards. Please try again later.");
      }
    }
  });
});

document.getElementById("logout-btn").addEventListener("click", () => {
  signOut();

  // Clear the manga list
  const mangaList = document.getElementById("manga-list");
  mangaList.innerHTML = "<p></p>";

  // Update button visibility
  document.getElementById("login-btn").style.display = "block";
  document.getElementById("logout-btn").style.display = "none";
});

// ============================
//   Sign Out Function
// ============================

function signOut() {
  // Clear tokens from local storage (Disclaimer - This is not secure for production)
  localStorage.removeItem("idToken");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");

  alert("Logged out successfully!");
}

document.addEventListener("DOMContentLoaded", async () => {
  const idToken = localStorage.getItem("idToken");
  const accessToken = localStorage.getItem("accessToken");

  if (idToken && accessToken) {
    const isValid = await validateToken(accessToken);
    if (isValid) {
      document.getElementById("login-btn").style.display = "none";
      document.getElementById("logout-btn").style.display = "block";

      // Fetch user-specific manga cards
      try {
        await fetchSavedMangaCards();
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    } else {
      localStorage.clear();
    }
  } else {
    document.getElementById("login-btn").style.display = "block";
    document.getElementById("logout-btn").style.display = "none";
  }
});

// ============================
//   Validate Token Function
// ============================

async function validateToken(accessToken) {
  try {
    // Example: Decode the token and check expiration
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime; // Token is valid if not expired
  } catch (error) {
    return false;
  }
}

// ============================
//   Sign Out Function
// ============================

function signOut() {
  // Clear tokens from local storage (Disclaimer - This is not secure for production)
  localStorage.removeItem("idToken");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");

  // Trigger the logout success notification
  showNotification("Logged out successfully!", "success");

  // Clear the manga list
  const mangaList = document.getElementById("manga-list");
  mangaList.innerHTML = "<p></p>";

  // Update button visibility
  document.getElementById("login-btn").style.display = "block";
  document.getElementById("logout-btn").style.display = "none";
}

// ============================
//   Refresh Tokens Function
// ============================

async function refreshTokens() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    return null;
  }

  const params = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
      SECRET_HASH: calculateSecretHash("demo@otakustack.org"),
    },
  };

  try {
    const data = await cognitoIdentityServiceProvider
      .initiateAuth(params)
      .promise();

    // Update tokens in local storage (Disclaimer - This is not secure for production)
    localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
    localStorage.setItem("accessToken", data.AuthenticationResult.AccessToken);

    return data.AuthenticationResult;
  } catch (error) {
    return null;
  }
}

// ============================
//   Fetch Saved Manga Cards Function
// ============================

async function fetchSavedMangaCards() {
  const idToken = localStorage.getItem("idToken");
  if (!idToken) {
    showNotification("You must log in to view your saved cards.", "error");
    return;
  }

  try {
    const response = await fetch(
      "API_ENDPOINT", // API Endpoint Placeholder
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch saved manga cards. Status: ${response.status}`
      );
    }

    const apiResponse = await response.json();

    // Parse the body field if it exists
    const savedMangaCards = apiResponse.body
      ? JSON.parse(apiResponse.body)
      : [];

    // Clear the manga list but preserve the template card
    const mangaList = document.getElementById("manga-list");
    const templateCard = document.querySelector(".manga-card.template");
    mangaList.innerHTML = ""; // Clear all rows and cards
    if (templateCard) {
      mangaList.appendChild(templateCard); // Preserve the template card
    }

    // Add manga cards to the list
    savedMangaCards.forEach((mangaData) => {
      const transformedData = {
        mangaId: mangaData.mangaId.S,
        coverUrl: mangaData.coverUrl.S,
        platform: mangaData.platform.S,
        userId: mangaData.userId.S,
        readChapter: parseInt(mangaData.readChapter.N, 10), // Ensure readChapter is parsed as a number
        latestChapter: mangaData.latestChapter.S,
        status: mangaData.status.S,
        title: mangaData.title.S,
      };
      addMangaCard(transformedData);
    });
  } catch (error) {
    showNotification(
      "Failed to load your manga cards. Please try again later.",
      "error"
    );
  }
}

// ============================
//   Fetch Manga from Lambda Proxy Function
// ============================

async function fetchFromLambdaProxy(url) {
  try {
    const response = await fetch(
      `${lambdaProxyUrl}?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy call failed with status ${response.status}`);
    }

    const data = await response.json();

    // Handle pre-signed URLs or base64-encoded images
    if (data.imageUrl) {
      return data.imageUrl; // Pre-signed URL
    } else if (data.isBase64Encoded && data.body) {
      return `data:${data.contentType};base64,${data.body}`; // Base64-encoded image
    }

    // Otherwise, return the entire response data (e.g., JSON responses)
    return data;
  } catch (error) {
    return null;
  }
}

// ============================
//   DOMContentLoaded Event Listener - Fetch Saved Manga Cards
// ============================

document.addEventListener("DOMContentLoaded", async () => {
  const mangaList = document.getElementById("manga-list");

  // Fetch saved manga cards from DynamoDB
  async function fetchSavedMangaCards() {
    const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
    if (!idToken) {
      showNotification(
        "You must log in to view your saved manga cards.",
        "error"
      ); // Use notification instead of alert
      return;
    }

    try {
      const response = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch saved manga cards. Status: ${response.status}`
        );
      }

      const apiResponse = await response.json();

      // Parse the body field if it exists
      const savedMangaCards = apiResponse.body
        ? JSON.parse(apiResponse.body)
        : [];

      // Clear the manga list but preserve the template card
      const mangaList = document.getElementById("manga-list");
      const templateCard = document.querySelector(".manga-card.template");
      mangaList.innerHTML = ""; // Clear all rows and cards
      if (templateCard) {
        mangaList.appendChild(templateCard); // Preserve the template card
      }

      // Add manga cards to the list
      savedMangaCards.forEach((mangaData) => {
        const transformedData = {
          mangaId: mangaData.mangaId.S,
          coverUrl: mangaData.coverUrl.S,
          platform: mangaData.platform.S,
          userId: mangaData.userId.S,
          readChapter: parseInt(mangaData.readChapter.N, 10), // Ensure readChapter is parsed as a number
          latestChapter: mangaData.latestChapter.S,
          status: mangaData.status.S,
          title: mangaData.title.S,
        };
        addMangaCard(transformedData);
      });
    } catch (error) {
      showNotification(
        "Failed to load your manga cards. Please try again later.",
        "error"
      );
    }
  }

  // Initialize existing cards
  await fetchSavedMangaCards();
});

const lambdaProxyUrl = "API_ENDPOINT"; // API Endpoint Placeholder

// ============================
//   Dynamic Event Listeners for Manga Card Buttons
// ============================

function addEventListeners(card, latestChapter) {
  const decreaseBtn = card.querySelector(".decrease-btn");
  const increaseBtn = card.querySelector(".increase-btn");
  const finishBtn = card.querySelector(".finish-btn");
  const resetBtn = card.querySelector(".reset-btn");
  const readChapterInput = card.querySelector(".read-chapter");
  const platformDropdown = card.querySelector(".platform-name");

  const mangaId = card.getAttribute("data-id"); // Get the manga ID from the card

  // Function to save updates to the backend
  async function saveUpdate(updateData) {
    const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
    if (!idToken) {
      return;
    }

    try {
      const response = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save update. Status: ${response.status}`);
      }

      const responseData = await response.json();
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  // Event listeners for readChapter
  decreaseBtn.addEventListener("click", () => {
    let currentValue = parseInt(readChapterInput.value, 10) || 0;
    if (currentValue > 0) {
      readChapterInput.value = currentValue - 1;
      saveUpdate({ mangaId, readChapter: readChapterInput.value }); // Save the updated value
    }
  });

  increaseBtn.addEventListener("click", () => {
    let currentValue = parseInt(readChapterInput.value, 10) || 0;
    if (currentValue < latestChapter) {
      readChapterInput.value = currentValue + 1;
      saveUpdate({ mangaId, readChapter: readChapterInput.value }); // Save the updated value
    }
  });

  finishBtn.addEventListener("click", () => {
    readChapterInput.value = latestChapter;
    saveUpdate({ mangaId, readChapter: readChapterInput.value }); // Save the updated value
  });

  resetBtn.addEventListener("click", () => {
    readChapterInput.value = 0;
    saveUpdate({ mangaId, readChapter: readChapterInput.value }); // Save the updated value
  });

  readChapterInput.addEventListener("blur", () => {
    let currentValue = parseInt(readChapterInput.value, 10);
    if (isNaN(currentValue) || currentValue < 0) {
      readChapterInput.value = 0;
    } else if (currentValue > latestChapter) {
      readChapterInput.value = latestChapter;
    }
    saveUpdate({ mangaId, readChapter: readChapterInput.value }); // Save the updated value on blur
  });

  // Event listener for platform dropdown
  platformDropdown.addEventListener("change", () => {
    const selectedPlatform = platformDropdown.value;
    saveUpdate({ mangaId, platform: selectedPlatform }); // Save the updated platform
  });
}

// ============================
//   Dynamic Row Creation
// ============================

function createNewRow() {
  const mangaList = document.getElementById("manga-list");
  const newRow = document.createElement("div");
  newRow.classList.add("manga-row");
  mangaList.appendChild(newRow);
  return newRow;
}

// ============================
//   Dynamic Manga Card Creation
// ============================

function createMangaCard(mangaData) {
  // Create a new card element from scratch
  const newCard = document.createElement("div");
  newCard.classList.add("manga-card");
  newCard.setAttribute("data-id", mangaData.mangaId); // Set the data-id attribute
  newCard.style.display = "flex";

  // Add the cover image
  const coverImage = document.createElement("img");
  coverImage.classList.add("manga-cover");
  coverImage.src = mangaData.coverUrl || "/assets/backgrounds/error-bg.jpg";
  coverImage.alt = mangaData.title || "Manga Cover";
  newCard.appendChild(coverImage);

  // Create the manga info container
  const mangaInfo = document.createElement("div");
  mangaInfo.classList.add("manga-info");

  // Add the manga title
  const mangaTitle = document.createElement("h3");
  mangaTitle.classList.add("manga-title");
  mangaTitle.textContent = mangaData.title || "Unknown Title";
  mangaInfo.appendChild(mangaTitle);

  // Add the chapter info with status
  const chapterInfo = document.createElement("p");
  chapterInfo.classList.add("chapter-info");

  // Determine the status class
  const statusClass = mangaData.status
    ? `status-${mangaData.status.toLowerCase()}`
    : "status-unknown";

  chapterInfo.innerHTML = `
  Latest Update: <span class="latest-chapter">${
    mangaData.latestChapter || "0"
  }</span> <span class="manga-status ${statusClass}">${
    mangaData.status || "Unknown"
  }</span><br />
  <button class="reset-btn">↻</button>
  <button class="decrease-btn">−</button>
  <input type="number" class="read-chapter" value="${
    mangaData.readChapter || "0"
  }" min="0" />
  <button class="increase-btn">+</button>
  <button class="finish-btn">✓</button>
`;
  mangaInfo.appendChild(chapterInfo);

  // Add the platform dropdown and remove button
  const readWhere = document.createElement("p");
  readWhere.classList.add("read-where");
  readWhere.innerHTML = `
    Platform:
    <select class="platform-name">
      <option value="Tachimanga">Tachimanga</option>
      <option value="MangaDex">MangaDex</option>
      <option value="Viz Media">Viz Media</option>
      <option value="K MANGA">K MANGA</option>
      <option value="MangaNelo">MangaNelo</option>
      <option value="Other">Other</option>
    </select>
    <button class="remove-btn list-remove-btn">X</button>
  `;
  const platformDropdown = readWhere.querySelector(".platform-name");
  if (platformDropdown) {
    platformDropdown.value = mangaData.platform || "Tachimanga";
  }
  mangaInfo.appendChild(readWhere);

  // Append the manga info to the card
  newCard.appendChild(mangaInfo);

  // Add event listeners to the card
  addEventListeners(newCard, mangaData.latestChapter);

  // Add event listener to the "Remove" button
  const removeButton = readWhere.querySelector(".remove-btn");
  removeButton.addEventListener("click", () => {
    const mangaId = mangaData.mangaId;
    const confirmModal = document.getElementById("delete-confirm-modal");
    const confirmMessage = document.getElementById("delete-confirm-message");
    const confirmYes = document.getElementById("delete-confirm-yes");
    const confirmNo = document.getElementById("delete-confirm-no");

    // Set the confirmation message
    confirmMessage.textContent = `Are you sure you want to delete "${mangaData.title}" from your collection?`;

    // Show the modal
    confirmModal.style.display = "flex";

    // Handle "Yes" button click
    confirmYes.onclick = async () => {
      await removeMangaCard(mangaId); // Call the remove function
      newCard.remove(); // Remove the card from the DOM
      confirmModal.style.display = "none"; // Hide the modal
    };

    // Handle "No" button click
    confirmNo.onclick = () => {
      confirmModal.style.display = "none"; // Hide the modal
    };
  });

  return newCard;
}

// ============================
//   Add Manga Card From Search Results
// ============================

function addMangaCard(mangaData) {
  const mangaList = document.getElementById("manga-list");

  // Check if a card with the same mangaId already exists
  const existingCard = mangaList.querySelector(
    `.manga-card[data-id="${mangaData.mangaId}"]`
  );
  if (existingCard) {
    return; // Skip adding the duplicate card
  }

  let lastRow = mangaList.lastElementChild;

  // Create a new row if the last row is full or doesn't exist
  if (!lastRow || lastRow.children.length >= 10) {
    lastRow = createNewRow();
  }

  const newCard = createMangaCard(mangaData);
  if (!newCard) {
    return;
  }

  // Populate the read-chapter input with the saved value
  const readChapterInput = newCard.querySelector(".read-chapter");
  if (readChapterInput) {
    readChapterInput.value = mangaData.readChapter || 0;
  }

  lastRow.appendChild(newCard);
}

// ============================
//   Fetch Latest Chapter For Manga
// ============================

async function fetchLatestChapter(mangaId) {
  try {
    // Query the MangaDex API for the latest chapter
    const chapterData = await fetchFromLambdaProxy(
      `https://api.mangadex.org/chapter?manga=${mangaId}&limit=1&order[chapter]=desc`
    );

    // Check if the API returned valid chapter data
    if (chapterData && chapterData.data && chapterData.data.length > 0) {
      const latestChapter = chapterData.data[0].attributes.chapter;
      return latestChapter || "N/A";
    } else {
      // Fallback: Remove language filter and try again
      const fallbackChapterData = await fetchFromLambdaProxy(
        `https://api.mangadex.org/chapter?manga=${mangaId}&limit=1&order[createdAt]=desc`
      );

      if (
        fallbackChapterData &&
        fallbackChapterData.data &&
        fallbackChapterData.data.length > 0
      ) {
        const latestChapter = fallbackChapterData.data[0].attributes.chapter;
        return latestChapter || "N/A";
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  // Fallback to "N/A" if no chapter data is found
  return "N/A";
}

let resultsPopup = document.querySelector(".search-results-popup");
let lastResults = []; // Stores the last results

// ============================
//   Update Search Results Button State
// ============================

function updateButtonState(button, isInCollection, results) {
  // Update the button's text and class
  if (isInCollection) {
    button.textContent = "Remove";
    button.classList.remove("add-btn");
    button.classList.add("remove-btn");
  } else {
    button.textContent = "Add";
    button.classList.remove("remove-btn");
    button.classList.add("add-btn");
  }

  // Clone the button to remove all existing event listeners
  const newButton = button.cloneNode(true);

  // Attach the correct event listener based on the new state
  if (isInCollection) {
    newButton.addEventListener("click", async () => {
      const mangaId = newButton.getAttribute("data-id");
      await removeMangaCard(mangaId);
      updateButtonState(newButton, false, results); // Update to "Add"
    });
  } else {
    newButton.addEventListener("click", async () => {
      const mangaId = newButton.getAttribute("data-id");
      const manga = results.find((m) => m.id === mangaId);
      if (manga) {
        await addMangaCardFromSearch(manga);
        updateButtonState(newButton, true, results); // Update to "Remove"
      }
    });
  }

  // Replace the old button with the new one
  button.replaceWith(newButton);
}

// ============================
//   Add Manga Card From Search Results
// ============================

async function addMangaCardFromSearch(manga) {
  // Find the cover_art relationship
  const coverArt = manga.relationships.find((rel) => rel.type === "cover_art");
  let coverUrl = "/assets/backgrounds/error-bg.jpg"; // Default fallback image

  if (coverArt) {
    try {
      // Fetch the cover_art details if attributes are missing
      if (!coverArt.attributes) {
        const coverArtDetails = await fetchFromLambdaProxy(
          `https://api.mangadex.org/cover/${coverArt.id}`
        );
        if (coverArtDetails && coverArtDetails.data) {
          coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverArtDetails.data.attributes.fileName}`;
        }
      } else if (coverArt.attributes.fileName) {
        coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  } else {
  }

  // Fetch the status from MangaDex
  const status = manga.attributes.status || "Unknown";

  // Fetch the latest chapter
  let latestChapter = manga.attributes.lastChapter || "N/A";
  if (!latestChapter || latestChapter === "N/A") {
    latestChapter = await fetchLatestChapter(manga.id);
  }

  const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
  if (!idToken) {
    return;
  }

  // Decode the idToken to extract the userId (sub)
  const tokenParts = idToken.split(".");
  const payload = JSON.parse(atob(tokenParts[1]));
  const userId = payload.sub; // Extract the userId from the token

  const mangaData = {
    userId: userId,
    mangaId: manga.id,
    title: manga.attributes.title.en || "Unknown Title",
    coverUrl: coverUrl, // Send the original HTTP(S) URL
    latestChapter: latestChapter,
    status: status,
    readChapter: "0",
    platform: "Tachimanga", // Default platform
  };

  // Check if the card already exists in the DOM
  const mangaList = document.getElementById("manga-list");
  const existingCard = mangaList.querySelector(
    `.manga-card[data-id="${manga.id}"]`
  );
  if (existingCard) {
    return; // Skip adding the duplicate card
  }

  // Retry logic
  const maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    try {
      const response = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mangaData),
      });

      if (!response.ok) {
        throw new Error(`Failed to add manga card. Status: ${response.status}`);
      }

      const responseData = await response.json();

      const updatedMangaData = responseData.mangaData;
      addMangaCard(updatedMangaData);
      success = true;

      // **Trigger success notification**
      showNotification(
        `"${mangaData.title}" added to your collection!`,
        "success"
      );

      // Update the button state to "Remove" only if successful
      const button = resultsPopup.querySelector(
        `.add-btn[data-id="${manga.id}"]`
      );
      if (button) {
        button.style.display = "block"; // Show the button after adding
        updateButtonState(button, true, lastResults); // Update to "Remove"
      }
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        showNotification(
          `"${mangaData.title}" failed to add to collection.`,
          "error"
        );

        // Ensure the button remains in the "Add" state
        const button = resultsPopup.querySelector(
          `.add-btn[data-id="${manga.id}"]`
        );
        if (button) {
          button.style.display = "block"; // Show the button after failing
          updateButtonState(button, false, lastResults); // Ensure it stays "Add"
        }
      }
    }
  }
}

// ============================
//   Initialize Existing Cards
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const mangaList = document.getElementById("manga-list");

  // Function to initialize existing cards
  function initializeExistingCards() {
    const mangaCards = document.querySelectorAll(".manga-card:not(.template)");
    mangaCards.forEach((card) => {
      const latestChapter = card.querySelector(".latest-chapter").textContent;
      addEventListeners(card, latestChapter);
    });
  }

  // Initialize existing cards
  initializeExistingCards();
});

// ============================
//   DOMContentLoaded Event Listener
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const searchBar = document.querySelector(".search-bar");
  const searchContainer = document.querySelector(".search-container");
  const sortSearchSection = document.querySelector(".sort-search-section");
  const welcomeSection = document.querySelector(".welcome-section");

  // Declare variables for loadMoreButton and currentOffset
  let loadMoreButton = null; // Initialize as null
  let query = ""; // Initialize as an empty string
  let currentOffset = 0; // Start with offset 0
  let lastQuery = ""; // Stores the last query

  // Ensure the popup exists
  if (!resultsPopup) {
    resultsPopup = document.createElement("div");
    resultsPopup.classList.add("search-results-popup");
    searchContainer.appendChild(resultsPopup);
  }

  // ============================
  //  Update Visibility Based on Login/Logout State
  // ============================

  function updateVisibilityBasedOnLogin() {
    const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)

    if (!idToken) {
      if (searchBar) {
        searchBar.disabled = true;
        searchBar.placeholder = "Please log in to use the search.";
        searchBar.value = ""; // Clear the search bar value
      }
      if (sortSearchSection) {
        sortSearchSection.classList.add("hidden"); // Hide the sort-search-section
      }
      if (welcomeSection) {
        welcomeSection.classList.remove("hidden"); // Show the welcome section
      }
    } else {
      if (searchBar) {
        searchBar.disabled = false;
        searchBar.placeholder = "Search for manga...";
      }
      if (sortSearchSection) {
        sortSearchSection.classList.remove("hidden"); // Show the sort-search-section
      }
      if (welcomeSection) {
        welcomeSection.classList.add("hidden"); // Hide the welcome section
      }
    }
  }

  // Initial check on page load
  updateVisibilityBasedOnLogin();

  // Update visibility on login
  document.getElementById("login-btn").addEventListener("click", async () => {
    // Show the login modal
    const loginModal = document.getElementById("login-modal");
    loginModal.style.display = "flex";

    // Handle login form submission
    loginModal.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      // Attempt to sign in
      const tokens = await signIn(username, password);

      if (tokens) {
        loginModal.style.display = "none"; // Hide the modal

        // Update visibility
        updateVisibilityBasedOnLogin();
      } else {
        showNotification("Login failed. Please try again.", "error");
      }
    });
  });

  // Update visibility on logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    // Simulate logout logic here
    localStorage.removeItem("idToken"); // (Disclaimer - This is not secure for production)
    updateVisibilityBasedOnLogin();
  });

  // Handle search results popup
  let debounceTimeout;

  // ============================
  //  Search Bar Event Listener
  // ============================

  searchBar.addEventListener("input", () => {
    query = searchBar.value.trim(); // Update the global query variable
    clearTimeout(debounceTimeout); // Clear the previous timeout

    const loadingIndicator = document.getElementById("loading-indicator");

    debounceTimeout = setTimeout(async () => {
      if (query) {
        // Disable the search bar and show the loading indicator
        searchBar.disabled = true;
        loadingIndicator.style.display = "block";

        try {
          // Fetch the initial results
          const results = await fetchMangaDexResults(query, 0); // Start with offset 0

          // Clear previous results and show new ones
          await showSearchResults(results, false);

          // Update the last query and results
          lastQuery = query;
          lastResults = results;

          currentOffset = 5; // Reset the offset for subsequent results
        } finally {
          // Re-enable the search bar and hide the loading indicator
          searchBar.disabled = false;
          loadingIndicator.style.display = "none";
        }
      } else {
        // Hide the loading indicator if the query is empty
        loadingIndicator.style.display = "none";
        hideSearchResults();

        // Clear the last query and results
        lastQuery = "";
        lastResults = [];
      }
    }, 500);
  });

  searchBar.addEventListener("focus", () => {
    if (lastQuery && lastResults.length > 0) {
      // Show the previous results without re-querying
      resultsPopup.style.display = "block"; // Ensure the popup is visible
    }
  });

  // Prevent clicks inside the popup from propagating
  resultsPopup.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Add a global click listener to detect clicks outside the popup
  document.addEventListener("click", (event) => {
    const isClickInsidePopup =
      resultsPopup && resultsPopup.contains(event.target);
    const isClickInsideSearchBar =
      searchContainer && searchContainer.contains(event.target);

    // Only hide the popup if the click is outside both the popup and the search bar
    if (!isClickInsidePopup && !isClickInsideSearchBar) {
      hideSearchResults(); // Hide the popup but keep the query and results
    }
  });

  // Hide the search results popup
  function hideSearchResults() {
    if (resultsPopup) {
      resultsPopup.style.display = "none"; // Hide the popup
    }
  }

  // ============================
  //  Fetch MangaDex Results with Offset
  // ============================

  async function fetchMangaDexResults(query, offset = 0) {
    try {
      const apiGatewayUrl = "API_ENDPOINT"; // API Endpoint Placeholder

      // Construct the URL for the MangaDex API with the offset
      const mangadexApiUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(
        query
      )}&limit=5&offset=${offset}`;

      const requestUrl = `${apiGatewayUrl}?url=${encodeURIComponent(
        mangadexApiUrl
      )}`;

      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`);
      }

      const responseData = await response.json();

      return responseData.data || [];
    } catch (error) {
      return [];
    }
  }

  // ============================
  //  Show Search Results
  // ============================

  async function showSearchResults(results, append = false) {
    // If not appending, clear the resultsPopup
    if (!append) {
      resultsPopup.innerHTML = "";
    }

    // Generate the HTML for the results
    const resultsHTML = await Promise.all(
      results.map(async (manga) => {
        // Find the cover_art relationship
        const coverArt = manga.relationships.find(
          (rel) => rel.type === "cover_art"
        );

        let coverUrl = "/assets/backgrounds/error-bg.jpg"; // Default fallback image
        if (coverArt) {
          try {
            // Fetch the cover_art details if attributes are missing
            if (!coverArt.attributes) {
              const coverArtDetails = await fetchFromLambdaProxy(
                `https://api.mangadex.org/cover/${coverArt.id}`
              );
              if (coverArtDetails && coverArtDetails.data) {
                const fileName = coverArtDetails.data.attributes.fileName;
                const proxiedImage = await fetchFromLambdaProxy(
                  `https://uploads.mangadex.org/covers/${manga.id}/${fileName}`
                );
                if (proxiedImage) {
                  coverUrl = proxiedImage; // Use the pre-signed URL
                }
              }
            } else if (coverArt.attributes.fileName) {
              const proxiedImage = await fetchFromLambdaProxy(
                `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`
              );
              if (proxiedImage) {
                coverUrl = proxiedImage; // Use the pre-signed URL
              }
            }
          } catch (error) {
            console.error("Error fetching data:", error);
          }
        } else {
        }

        // Fetch the latest chapter if lastChapter is missing or null
        let latestChapter = manga.attributes.lastChapter || "N/A";
        if (!latestChapter || latestChapter === "N/A") {
          try {
            const chapterData = await fetchFromLambdaProxy(
              `https://api.mangadex.org/chapter?manga=${manga.id}&limit=1&translatedLanguage[]=en&order[chapter]=desc`
            );
            if (
              chapterData &&
              chapterData.data &&
              chapterData.data.length > 0
            ) {
              latestChapter = chapterData.data[0].attributes.chapter || "N/A";
            }
          } catch (error) {
            console.error("Error fetching data:", error);
          }
        }

        // Check if the manga is already in the user's collection
        const isInCollection = await checkIfMangaInCollection(manga.id);

        // Determine button label and class
        const buttonLabel = isInCollection ? "Remove" : "Add";
        const buttonClass = isInCollection ? "remove-btn" : "add-btn";

        const resultHTML = `
          <div class="search-result">
            <img
              src="${coverUrl}"
              alt="${manga.attributes.title.en || "Unknown Title"}"
              class="search-result-cover"
            />
            <div class="search-result-info">
              <p class="search-result-title">${
                manga.attributes.title.en || "Unknown Title"
              }</p>
              <p class="search-result-chapter">Latest Chapter: ${latestChapter}</p>
              <button class="${buttonClass}" data-id="${
          manga.id
        }">${buttonLabel}</button>
            </div>
          </div>
        `;
        return resultHTML;
      })
    ).then((htmlArray) => htmlArray.join(""));

    // Append the results to the popup
    resultsPopup.innerHTML += resultsHTML;

    // Wait for all images to load
    const images = resultsPopup.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve(); // Image is already loaded
            } else {
              img.onload = resolve; // Wait for the image to load
              img.onerror = resolve; // Resolve even if the image fails to load
            }
          })
      )
    );

    // Ensure the "Load More" button exists
    let loadMoreButton = resultsPopup.querySelector(".load-more-btn");
    if (!loadMoreButton) {
      loadMoreButton = document.createElement("button");
      loadMoreButton.textContent = "Load More";
      loadMoreButton.classList.add("load-more-btn");
      resultsPopup.appendChild(loadMoreButton); // Append the button to the popup
    }

    // Add event listener to the "Load More" button
    const attachLoadMoreListener = (button) => {
      button.addEventListener("click", async () => {
        // Hide the button while loading
        button.style.display = "none";

        const loadingIndicator = document.getElementById("loading-indicator");
        loadingIndicator.style.display = "block";

        try {
          // Fetch additional results
          const additionalResults = await fetchMangaDexResults(
            query,
            currentOffset
          );

          if (additionalResults.length > 0) {
            currentOffset += 5; // Increment the offset

            // Append new results
            await showSearchResults(additionalResults, true);

            // If fewer results are returned than the limit, hide the button
            if (additionalResults.length < 5) {
              button.style.display = "none";
            } else {
              // Move the button to the end of the results
              resultsPopup.appendChild(button);
              button.style.display = "block"; // Show the button again
            }
          } else {
            button.style.display = "none"; // Hide the button if no more results
          }
        } catch (error) {
        } finally {
          // Hide the loading indicator
          loadingIndicator.style.display = "none";
        }
      });
    };

    // Attach the event listener to the button
    attachLoadMoreListener(loadMoreButton);

    // Add event listeners to "Add" and "Remove" buttons
    resultsPopup.addEventListener("click", async (event) => {
      const button = event.target;

      if (button.classList.contains("add-btn")) {
        const mangaId = button.getAttribute("data-id");
        const manga = results.find((m) => m.id === mangaId);
        if (manga) {
          button.style.display = "none"; // Hide the button while adding
          await addMangaCardFromSearch(manga);
          updateButtonState(button, true, results); // Update to "Remove"
        }
      }
    });

    resultsPopup.querySelectorAll(".remove-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const mangaId = button.getAttribute("data-id");
        button.style.display = "none"; // Hide the button while removing
        await removeMangaCard(mangaId);
        updateButtonState(button, false, results); // Update to "Add"
      });
    });

    // Show the popup
    resultsPopup.style.display = "block";
  }

  // ============================
  //  Check If Manga Is In Collection
  // ============================

  async function checkIfMangaInCollection(mangaId) {
    const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
    if (!idToken) {
      return false;
    }

    try {
      const response = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      });

      if (response.ok) {
        const apiResponse = await response.json();
        const savedMangaCards = apiResponse.body
          ? JSON.parse(apiResponse.body)
          : [];
        return savedMangaCards.some((manga) => manga.mangaId.S === mangaId);
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  // ============================
  //  Remove Card From Main List
  // ============================

  function removeCardFromMainList(mangaId) {
    // Find the card in the main manga list using the mangaId
    const card = document.querySelector(`.manga-card[data-id="${mangaId}"]`);
    if (card) {
      card.remove(); // Remove the card from the DOM
    } else {
    }
  }

  // ============================
  //  Remove Manga Card from Collection
  // ============================

  async function removeMangaCard(mangaId) {
    const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
    if (!idToken) {
      return;
    }

    // Decode the idToken to extract the userId
    const tokenParts = idToken.split(".");
    const payload = JSON.parse(atob(tokenParts[1]));
    const userId = payload.sub;

    try {
      // Fetch the manga data from DynamoDB to get the coverUrl
      const response = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch manga card data. Status: ${response.status}`
        );
      }

      const apiResponse = await response.json();
      const savedMangaCards = apiResponse.body
        ? JSON.parse(apiResponse.body)
        : [];
      const mangaData = savedMangaCards.find(
        (manga) => manga.mangaId.S === mangaId
      );

      if (!mangaData) {
        return;
      }

      const coverUrl = mangaData.coverUrl.S; // Get the cover URL

      // Call the Lambda function to remove the manga card and delete the S3 image
      const deleteResponse = await fetch("API_ENDPOINT", {
        // API Endpoint Placeholder
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, mangaId, coverUrl }),
      });

      if (!deleteResponse.ok) {
        throw new Error(
          `Failed to remove manga card. Status: ${deleteResponse.status}`
        );
      }

      // Remove the card from the main manga list
      removeCardFromMainList(mangaId);

      // **Trigger success notification**
      showNotification("Manga card removed from your collection!", "success");

      // Dynamically update the button state in the search results
      const button = resultsPopup.querySelector(
        `.remove-btn[data-id="${mangaId}"]`
      );
      if (button) {
        button.style.display = "block"; // Hide the button while removing
        updateButtonState(button, false, lastResults); // Update to "Add"
      }
    } catch (error) {}
  }

  // Expose removeMangaCard to the global scope
  window.removeMangaCard = removeMangaCard;

  // Hide the search results popup
  function hideSearchResults() {
    resultsPopup.style.display = "none";
  }
});

// ============================
//   Helper To AWS Credentials Initialization
// ============================

async function initializeAWSCredentials() {
  const idToken = localStorage.getItem("idToken"); // (Disclaimer - This is not secure for production)
  if (!idToken) {
    alert("You must log in to access your saved manga cards.");
    return null; // Exit early if no idToken is found
  }

  // Initialize AWS credentials
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: "Identity_Pool_ID", // Identity Pool ID
    Logins: {
      User_Pool_ID: idToken, // User Pool ID
    },
  });

  // Refresh AWS credentials
  return new Promise((resolve, reject) => {
    AWS.config.credentials.refresh((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ============================
//   User Icon Dropdown Functionality
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const userIcon = document.querySelector(".user-icon");
  const userDropdown = document.querySelector(".user-dropdown");

  if (userIcon && userDropdown) {
    // Toggle dropdown visibility on user icon click
    userIcon.addEventListener("click", () => {
      userDropdown.classList.toggle("visible");
    });

    // Hide dropdown if the user clicks outside of it
    document.addEventListener("click", (event) => {
      const isClickInsideDropdown = userDropdown.contains(event.target);
      const isClickOnIcon = userIcon.contains(event.target);

      if (!isClickInsideDropdown && !isClickOnIcon) {
        userDropdown.classList.remove("visible");
      }
    });
  }
});

// ============================
//   Show Notification Functionality
// ============================

function showNotification(message, type = "success") {
  const notificationBar = document.getElementById("notification-bar");

  // Set the message and style based on the type
  notificationBar.textContent = message;
  notificationBar.style.backgroundColor =
    type === "success" ? "#007bff" : "#ff3030";

  // Show the notification with animation
  notificationBar.classList.add("show");

  // Hide the notification after 3 seconds
  setTimeout(() => {
    notificationBar.classList.remove("show");
  }, 2000);
}

// Example usage
document.getElementById("login-btn").addEventListener("click", () => {
  const loginModal = document.getElementById("login-modal");
  loginModal.style.display = "flex"; // Show the login modal
});

document.getElementById("logout-btn").addEventListener("click", () => {
  showNotification("Logged out successfully!", "error");
});

// ============================
//   Tooltip Functionality for Manga Titles
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const mangaList = document.getElementById("manga-list");

  // Event delegation for hover events on manga titles
  mangaList.addEventListener(
    "mouseenter",
    (event) => {
      if (event.target.classList.contains("manga-title")) {
        const title = event.target;
        const fullTitle = title.textContent;
        const parentInfo = title.closest(".manga-info"); // Get the parent container

        // Check if the tooltip already exists
        let tooltip = parentInfo.querySelector(".manga-title-tooltip");
        if (!tooltip) {
          // Create the tooltip element
          tooltip = document.createElement("div");
          tooltip.classList.add("manga-title-tooltip");
          tooltip.textContent = fullTitle;

          // Append the tooltip to the parent container
          parentInfo.appendChild(tooltip);
        }

        // Show the tooltip
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
      }
    },
    true
  );

  mangaList.addEventListener(
    "mouseleave",
    (event) => {
      if (event.target.classList.contains("manga-title")) {
        const title = event.target;
        const parentInfo = title.closest(".manga-info"); // Get the parent container
        const tooltip = parentInfo.querySelector(".manga-title-tooltip");
        if (tooltip) {
          // Hide and remove the tooltip
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
          tooltip.remove();
        }
      }
    },
    true
  );
});

// ============================
//   Grab-and-Scroll Manga Row Functionality
// ============================

document.addEventListener("DOMContentLoaded", () => {
  // Function to enable grab-and-scroll for a container
  function enableGrabAndScroll(container) {
    let isDragging = false;
    let startX;
    let scrollLeft;

    container.addEventListener("mousedown", (e) => {
      isDragging = true;
      container.classList.add("dragging");
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener("mouseleave", () => {
      isDragging = false;
      container.classList.remove("dragging");
    });

    container.addEventListener("mouseup", () => {
      isDragging = false;
      container.classList.remove("dragging");
    });

    container.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 2; // Adjust scrolling speed
      container.scrollLeft = scrollLeft - walk;
    });

    // Function to disable default drag behavior for images
    function disableImageDrag(images) {
      images.forEach((img) => {
        img.addEventListener("dragstart", (e) => {
          e.preventDefault();
        });
      });
    }

    // Disable drag behavior for existing images
    const images = container.querySelectorAll("img");
    disableImageDrag(images);

    // Observe for dynamically added images
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === "IMG") {
            disableImageDrag([node]); // Disable drag for the new image
          } else if (node.querySelectorAll) {
            // If the added node contains images, disable drag for them
            const newImages = node.querySelectorAll("img");
            disableImageDrag(newImages);
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // Apply grab-and-scroll to all existing manga rows
  const mangaRows = document.querySelectorAll(".manga-row");
  mangaRows.forEach((row) => enableGrabAndScroll(row));

  // Apply grab-and-scroll to dynamically created rows
  const mangaList = document.getElementById("manga-list");
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.classList && node.classList.contains("manga-row")) {
          enableGrabAndScroll(node);
        }
      });
    });
  });

  observer.observe(mangaList, { childList: true });
});

// ============================
//   Sort and Search Functionality
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const sortDropdown = document.getElementById("sort-dropdown");
  const collectionSearch = document.getElementById("collection-search");
  const mangaList = document.getElementById("manga-list");

  if (sortDropdown && mangaList) {
    sortDropdown.addEventListener("change", () => {
      const sortOption = sortDropdown.value;
      const mangaRows = Array.from(mangaList.querySelectorAll(".manga-row"));

      // Flatten all cards into a single array
      const mangaCards = mangaRows.flatMap((row) =>
        Array.from(row.querySelectorAll(".manga-card:not(.template)"))
      );

      // Separate visible and hidden cards
      const visibleCards = mangaCards.filter(
        (card) => card.style.display !== "none"
      );
      const hiddenCards = mangaCards.filter(
        (card) => card.style.display === "none"
      );

      // Sort the visible cards based on the selected option
      visibleCards.sort((a, b) => {
        const titleA = a.querySelector(".manga-title").textContent.trim();
        const titleB = b.querySelector(".manga-title").textContent.trim();
        const chapterA = parseInt(
          a.querySelector(".latest-chapter").textContent.trim(),
          10
        );
        const chapterB = parseInt(
          b.querySelector(".latest-chapter").textContent.trim(),
          10
        );
        const readChapterA = parseInt(
          a.querySelector(".read-chapter").value.trim(),
          10
        );
        const readChapterB = parseInt(
          b.querySelector(".read-chapter").value.trim(),
          10
        );
        const statusA = a.querySelector(".manga-status").textContent.trim();
        const statusB = b.querySelector(".manga-status").textContent.trim();

        switch (sortOption) {
          case "alphabetical":
            return titleA.localeCompare(titleB);
          case "highest-chapter":
            return chapterB - chapterA; // Descending order
          case "lowest-chapter":
            return chapterA - chapterB; // Ascending order
          case "status":
            // Sort by ongoing first, then hiatus, then completed
            if (statusA === "ongoing" && statusB !== "ongoing") return -1;
            if (statusA === "hiatus" && statusB === "completed") return -1;
            if (statusA === "completed" && statusB !== "completed") return 1;
            if (statusA === "hiatus" && statusB === "ongoing") return 1;
            return titleA.localeCompare(titleB); // Fallback to alphabetical
          case "unread-progress":
            // Sort by the difference between latestChapter and readChapter
            const unreadA = chapterA - readChapterA;
            const unreadB = chapterB - readChapterB;
            return unreadB - unreadA; // Descending order
          default:
            return 0;
        }
      });

      // Clear the manga list and re-add sorted cards in rows of 10
      mangaList.innerHTML = "";
      let currentRow = createNewRow();

      // Add visible cards first
      visibleCards.forEach((card, index) => {
        if (index > 0 && index % 10 === 0) {
          currentRow = createNewRow(); // Create a new row after every 10 cards
        }
        currentRow.appendChild(card);
      });

      // Add hidden cards at the end
      hiddenCards.forEach((card, index) => {
        if ((visibleCards.length + index) % 10 === 0) {
          currentRow = createNewRow(); // Create a new row after every 10 cards
        }
        currentRow.appendChild(card);
      });
    });

    // Trigger sorting when the search input changes
    if (collectionSearch) {
      collectionSearch.addEventListener("input", () => {
        const query = collectionSearch.value.trim().toLowerCase();
        const mangaCards = mangaList.querySelectorAll(
          ".manga-card:not(.template)"
        );

        // Update the display property of cards based on the search query
        mangaCards.forEach((card) => {
          const title = card
            .querySelector(".manga-title")
            .textContent.trim()
            .toLowerCase();
          if (title.includes(query)) {
            card.style.display = "flex"; // Show matching cards
          } else {
            card.style.display = "none"; // Hide non-matching cards
          }
        });

        // Trigger the sorting logic to reorganize the cards
        sortDropdown.dispatchEvent(new Event("change"));
      });
    }
  }

  // Function to create a new manga row
  function createNewRow() {
    const newRow = document.createElement("div");
    newRow.classList.add("manga-row");
    mangaList.appendChild(newRow);
    return newRow;
  }
});

// ============================
//  Rotating Text Functionality
// ============================

document.addEventListener("DOMContentLoaded", () => {
  const rotatingText1 = document.querySelector(".rotating-text-1");
  const textOptions1 = [
    "Welcome back.",
    "Hello again.",
    "Hey, champ.",
    "Still here?",
    "Hi there.. friendo.",
    "Ah, user detected.",
    "You're early.",
  ];
  let index = 0;

  setInterval(() => {
    rotatingText1.style.opacity = 0;
    rotatingText1.style.transform = "translateY(-10px)";

    setTimeout(() => {
      index = (index + 1) % textOptions1.length;
      rotatingText1.textContent = textOptions1[index];
      rotatingText1.style.opacity = 1;
      rotatingText1.style.transform = "translateY(0)";
    }, 500);
  }, 4000);
});

document.addEventListener("DOMContentLoaded", () => {
  const rotatingText2 = document.querySelector(".rotating-text-2");
  const textOptions2 = [
    "Your reading list has evolved into a cry for help.",
    "I kept your spot warm. Just like last month.",
    "Another day, another series you swore you'd finish.",
    "I'm flattered, but you're not exactly my type.",
    "The manga missed you. Not really, but let’s pretend.",
    "Initiating false sense of chapter progress...",
    "For someone who's three story arcs behind.",
  ];
  let index = 0;

  setInterval(() => {
    rotatingText2.style.opacity = 0;
    rotatingText2.style.transform = "translateY(-10px)";

    setTimeout(() => {
      index = (index + 1) % textOptions2.length;
      rotatingText2.textContent = textOptions2[index];
      rotatingText2.style.opacity = 1;
      rotatingText2.style.transform = "translateY(0)";
    }, 500);
  }, 4000);
});

// ============================
//   Intersection Observer for Welcome Text Animation
// ============================

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("showgeneric-1"); // Add the animation class
    } else {
      entry.target.classList.remove("showgeneric-1"); // Remove the animation class
    }
  });
});

// Select all elements to observe
const hiddenElements = document.querySelectorAll(".welcome-text-box");
hiddenElements.forEach((el) => observer.observe(el));
