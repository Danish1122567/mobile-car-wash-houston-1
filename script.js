const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");
const revealItems = document.querySelectorAll(".reveal");
const galleryFilters = document.querySelectorAll(".filter-btn");
const galleryItems = document.querySelectorAll(".gallery-item");
const bookingForm = document.querySelector("#bookingForm");
const toast = document.querySelector("#toast");

const pageName = document.body.dataset.page;
const pageMap = {
  home: "index.html",
  services: "services.html",
  pricing: "pricing.html",
  gallery: "gallery.html",
  about: "about.html",
  areas: "service-areas.html",
  booking: "booking.html"
};

function setHeaderShadow() {
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 8);
}

function closeMenu() {
  if (!menuToggle || !navMenu) return;
  menuToggle.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  navMenu.classList.remove("open");
  document.body.classList.remove("menu-open");
}

function showToast(message, type = "success") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 5200);
}

function normalizePhone(value) {
  return value.replace(/[^\d+().\-\s]/g, "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function setFieldError(field, message) {
  const group = field.closest(".form-group");
  const error = group?.querySelector(".error-text");
  if (!group || !error) return;
  group.classList.toggle("invalid", Boolean(message));
  error.textContent = message || "";
}

function validateField(field) {
  const label = field.dataset.label || field.name;
  const value = field.value.trim();
  let message = "";

  if (field.required && !value) {
    message = `${label} is required.`;
  } else if (field.type === "email" && value && !isValidEmail(value)) {
    message = "Enter a valid email address.";
  } else if (field.type === "tel" && value && !isValidPhone(value)) {
    message = "Enter a valid phone number.";
  } else if (field.type === "date" && value) {
    const selectedDate = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      message = "Choose today or a future date.";
    }
  } else if (field.name === "vehicle" && value && value.length < 3) {
    message = "Enter vehicle make, model, and year.";
  }

  setFieldError(field, message);
  return !message;
}

function getBookingPayload(form) {
  const formData = new FormData(form);
  return {
    firstName: formData.get("firstName")?.trim() || "",
    lastName: formData.get("lastName")?.trim() || "",
    phone: normalizePhone(formData.get("phone") || ""),
    email: formData.get("email")?.trim() || "",
    service: formData.get("service") || "",
    vehicleType: formData.get("vehicleType") || "",
    preferredDate: formData.get("preferredDate") || "",
    vehicle: formData.get("vehicle")?.trim() || "",
    notes: formData.get("notes")?.trim() || ""
  };
}

function setSubmitLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  const label = button.querySelector(".btn-text");
  if (label) {
    label.textContent = isLoading ? "Submitting..." : "📅 Claim My Booking →";
  }
}

function setupBookingForm() {
  if (!bookingForm) return;

  const fields = bookingForm.querySelectorAll("input, select, textarea");
  const submitButton = bookingForm.querySelector("button[type='submit']");
  const alertBox = bookingForm.querySelector(".form-alert");
  const dateField = bookingForm.querySelector("input[type='date']");

  if (dateField) {
    dateField.min = new Date().toISOString().split("T")[0];
  }

  fields.forEach((field) => {
    field.addEventListener("input", () => validateField(field));
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("change", () => validateField(field));
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertBox?.classList.remove("show", "success", "error");

    const isValid = Array.from(fields).every(validateField);
    if (!isValid) {
      showToast("Please fix the highlighted fields before submitting.", "error");
      bookingForm.querySelector(".form-group.invalid input, .form-group.invalid select, .form-group.invalid textarea")?.focus();
      return;
    }

    setSubmitLoading(submitButton, true);

    try {
      const response = await fetch("/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getBookingPayload(bookingForm))
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Booking could not be submitted. Please try again.");
      }

      bookingForm.reset();
      fields.forEach((field) => setFieldError(field, ""));
      if (alertBox) {
        alertBox.textContent = "✅ Booking received! We'll confirm within 10–15 minutes via phone or Messenger.";
        alertBox.classList.add("show", "success");
      }
      showToast("Booking received! We'll confirm within 10–15 minutes.", "success");
    } catch (error) {
      if (alertBox) {
        alertBox.textContent = error.message;
        alertBox.classList.add("show", "error");
      }
      showToast(error.message, "error");
    } finally {
      setSubmitLoading(submitButton, false);
    }
  });
}

function setupGalleryFilters() {
  if (!galleryFilters.length || !galleryItems.length) return;

  galleryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      galleryFilters.forEach((item) => item.classList.toggle("active", item === button));
      galleryItems.forEach((item) => {
        const categories = item.dataset.category?.split(" ") || [];
        const shouldShow = filter === "all" || categories.includes(filter);
        item.hidden = !shouldShow;
      });
    });
  });
}

function setupLightbox() {
  const lightbox = document.querySelector(".lightbox");
  if (!lightbox) return;

  const image = lightbox.querySelector("img");
  const closeButton = lightbox.querySelector(".lightbox-close");

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => {
      const img = item.querySelector("img");
      if (!img || !image) return;
      image.src = img.src;
      image.alt = img.alt;
      lightbox.classList.add("open");
      document.body.classList.add("lightbox-open");
      closeButton?.focus();
    });
  });

  const closeLightbox = () => {
    lightbox.classList.remove("open");
    document.body.classList.remove("lightbox-open");
  };

  closeButton?.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
      closeMenu();
    }
  });
}

function setupNav() {
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      navMenu.classList.toggle("open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      closeMenu();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll(".nav-menu a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === pageMap[pageName]) {
      link.classList.add("active");
    }
    link.addEventListener("click", closeMenu);
  });
}

function setupRevealAnimations() {
  if (!revealItems.length) return;

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

window.addEventListener("scroll", setHeaderShadow, { passive: true });
document.addEventListener("DOMContentLoaded", () => {
  setHeaderShadow();
  setupNav();
  setupRevealAnimations();
  setupGalleryFilters();
  setupLightbox();
  setupBookingForm();
});
