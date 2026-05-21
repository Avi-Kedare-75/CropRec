// ============================
// UNIVERSAL NAVBAR HANDLER
// ============================

function loadUser() {
  const user = JSON.parse(localStorage.getItem("user"));
  const loginNav = document.getElementById("loginNav");
  const userMenu = document.getElementById("userMenu");
  const userIcon = document.getElementById("userIcon");

  if (!loginNav || !userMenu) return; // safeguard

  if (!user) {
    // Not logged in → show LOGIN
    loginNav.classList.remove("hidden");
    userMenu.classList.add("hidden");
    return;
  }

  // Hide login button
  loginNav.classList.add("hidden");

  // Show user profile section
  userMenu.classList.remove("hidden");

  // Set avatar first letter
  userIcon.innerText = user.name.charAt(0).toUpperCase();
}

// ============================
// DROPDOWN TOGGLE
// ============================

document.addEventListener("click", (e) => {
  const icon = document.getElementById("userIcon");
  const dropdown = document.getElementById("userDropdown");

  if (!icon || !dropdown) return;

  if (icon.contains(e.target)) {
    dropdown.classList.toggle("hidden");
  } else if (!dropdown.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

// ============================
// LOGOUT FUNCTION
// ============================

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// Load user immediately
window.addEventListener("DOMContentLoaded", loadUser);
