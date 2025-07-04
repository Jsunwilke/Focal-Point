// src/utils/validation.js

// Email validation
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
export const isValidPassword = (password) => {
  if (!password) return false;
  return password.length >= 6;
};

// Phone number validation (basic)
export const isValidPhoneNumber = (phone) => {
  if (!phone) return true; // Optional field
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

// Required field validation
export const isRequired = (value) => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

// Name validation
export const isValidName = (name) => {
  if (!name) return false;
  return name.trim().length >= 2;
};

// Organization name validation
export const isValidOrganizationName = (name) => {
  if (!name) return false;
  return name.trim().length >= 2;
};
