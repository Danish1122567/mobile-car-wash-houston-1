const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

let writeQueue = Promise.resolve();

app.use(cors());
app.use(bodyParser.json({ limit: "50kb" }));
app.use(bodyParser.urlencoded({ extended: false, limit: "50kb" }));
app.use(express.static(__dirname));

function ensureBookingsFile() {
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, "[]\n", "utf8");
  }
}

async function readBookings() {
  ensureBookingsFile();
  const raw = await fs.promises.readFile(BOOKINGS_FILE, "utf8");
  if (!raw.trim()) return [];

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error("Booking history file is not valid JSON.");
  }
}

async function writeBookings(bookings) {
  const tempFile = `${BOOKINGS_FILE}.tmp`;
  await fs.promises.writeFile(tempFile, `${JSON.stringify(bookings, null, 2)}\n`, "utf8");
  await fs.promises.rename(tempFile, BOOKINGS_FILE);
}

function cleanString(value, maxLength = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validateBooking(body) {
  const allowedServices = new Set(["Basic Wash", "Interior Cleaning", "Full Detail", "Premium Detail", "Custom Service"]);
  const allowedVehicleTypes = new Set(["Sedan", "SUV", "Truck", "Van", "Luxury Vehicle"]);

  const booking = {
    firstName: cleanString(body.firstName, 60),
    lastName: cleanString(body.lastName, 60),
    phone: cleanString(body.phone, 30),
    email: cleanString(body.email, 120).toLowerCase(),
    service: cleanString(body.service, 80),
    vehicleType: cleanString(body.vehicleType, 60),
    preferredDate: cleanString(body.preferredDate, 20),
    vehicle: cleanString(body.vehicle, 140),
    notes: cleanString(body.notes, 800)
  };

  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneDigits = booking.phone.replace(/\D/g, "");

  if (!booking.firstName) errors.firstName = "First name is required.";
  if (!booking.lastName) errors.lastName = "Last name is required.";
  if (!booking.phone || phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = "Valid phone number is required.";
  if (!booking.email || !emailPattern.test(booking.email)) errors.email = "Valid email address is required.";
  if (!allowedServices.has(booking.service)) errors.service = "Choose a valid service.";
  if (!allowedVehicleTypes.has(booking.vehicleType)) errors.vehicleType = "Choose a valid vehicle type.";
  if (!booking.preferredDate || Number.isNaN(Date.parse(booking.preferredDate))) {
    errors.preferredDate = "Preferred date is required.";
  } else {
    const selectedDate = new Date(`${booking.preferredDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) errors.preferredDate = "Preferred date must be today or later.";
  }
  if (!booking.vehicle || booking.vehicle.length < 3) errors.vehicle = "Vehicle make, model, and year are required.";

  return { booking, errors };
}

app.post("/book", async (req, res) => {
  const { booking, errors } = validateBooking(req.body || {});

  if (Object.keys(errors).length) {
    return res.status(400).json({
      success: false,
      message: "Please fix the highlighted booking details.",
      errors
    });
  }

  const record = {
    id: `BLZ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    ...booking,
    status: "new",
    createdAt: new Date().toISOString()
  };

  writeQueue = writeQueue.then(async () => {
    const bookings = await readBookings();
    bookings.push(record);
    await writeBookings(bookings);
  });

  try {
    await writeQueue;
    return res.status(201).json({
      success: true,
      message: "Booking received! We'll confirm within 10–15 minutes via phone or Messenger.",
      booking: record
    });
  } catch (error) {
    console.error("Booking save failed:", error);
    return res.status(500).json({
      success: false,
      message: "We could not save your booking right now. Please try again or message us directly."
    });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const bookings = await readBookings();
    return res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    console.error("Booking history read failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve booking history."
    });
  }
});

ensureBookingsFile();

app.listen(PORT, () => {
  console.log(`Bleenz Car Wash site running at http://localhost:${PORT}`);
});
