# Smart Fields Data Source Mapping - Where Information Comes From

This document explains where each "smart field" (auto-filling field) gets its information from in your app.

## What Are Smart Fields?

Smart fields are form fields that automatically fill themselves out with information from your database, so users don't have to type the same information over and over.

## Smart Field Types & Where They Get Their Data

### 1. **Mileage Calculator**
*This calculates the round-trip miles from the photographer's home to the schools they visit*

**Where the web app currently looks for information:**
- **Photographer's Home Address:** 
  - Looks in the "users" database table
  - Tries to find: Street address, city, state, and zip code
  - **Problem:** The app doesn't know where to find this information properly
  
- **School Addresses:**
  - Looks in the "schools" database table  
  - Expects to find a complete address for each school
  - **Problem:** The app is looking for school addresses in the wrong place

**Where your iPhone app gets this same information:**
- **Photographer's Home:** Saved on the phone in "userHomeAddress"
- **Schools:** Selected schools with their addresses

**❓ What I need from you:** 
- In your database, where exactly is the photographer's home address stored?
- In your database, where exactly are the school addresses stored?
- Are school addresses stored as one text field or separate fields (street, city, state, zip)?

---

### 2. **Today's Date**
*Automatically fills in today's date*

**Where it gets information:** Uses the computer's current date

**❓ What I need from you:** 
- What date format do you want? (MM/DD/YYYY, YYYY-MM-DD, etc.)
- Does this work correctly for you?

---

### 3. **Current Time**
*Automatically fills in the current time*

**Where it gets information:** Uses the computer's current time

**❓ What I need from you:** 
- What time format do you want? (12-hour with AM/PM, 24-hour, etc.)
- Does this work correctly for you?

---

### 4. **Photographer Name**
*Automatically fills in who is taking photos*

**Where the web app currently looks for information:**
- **Primary source:** Looks in "users" table for "firstName" field
- **Backup:** Uses whoever is selected from a dropdown

**Where your iPhone app gets this same information:**
- Uses the "userFirstName" saved on the phone

**❓ What I need from you:** 
- In your database "users" table, what is the exact name of the field that stores the photographer's first name?
- Do you want first name only, or first + last name?
- Should it always use the logged-in person, or allow selecting different photographers?

---

### 5. **School Name**
*Automatically fills in which school(s) are being visited*

**Where the web app currently looks for information:**
- **Problem:** Looks for "name" field but your schools might use different field names
- **Problem:** Shows ALL schools instead of just selected ones

**Where your iPhone app gets this same information:**
- Uses schools that the user specifically selects for that report

**❓ What I need from you:** 
- In your database "schools" table, what is the exact name of the field that stores the school name?
- How should multiple schools be displayed? (comma-separated, line-separated, etc.)

---

### 6. **Photo Count**
*Counts how many photos are attached*

**Where the web app currently looks for information:**
- **Problem:** Doesn't actually count photos (always shows 0)

**Where your iPhone app gets this same information:**
- Counts photos attached to the report

**❓ What I need from you:** 
- Do you want photo counting in the web app?
- If yes, where are photos stored in your database?
- If no, should we remove this smart field?

---

### 7. **Current GPS Location**
*Gets the current GPS coordinates*

**Where it gets information:** Asks the user's device for current location

**❓ What I need from you:** 
- Do you want this feature?
- What format: coordinates (lat, lng) or actual address?

---

### 8. **Weather Conditions**
*Gets current weather*

**Where it gets information:** 
- **Problem:** Not implemented yet (always shows placeholder)

**❓ What I need from you:** 
- Do you want weather information?
- If yes, what format? (temperature, conditions, both?)
- If no, should we remove this smart field?

---

## Your Database Structure (What I Think vs. What's Actually There)

### Users Table
**What I think it looks like:**
- firstName: "John"
- lastName: "Smith"  
- homeAddress: ??? (This is what I need to know)

**❓ What I need from you:**
- What are the exact field names in your users table?
- How is the home address stored? (one field or multiple fields?)

### Schools Table  
**What I think it looks like:**
- schoolName: ??? (What field name?)
- address: ??? (How is this stored?)
- coordinates: ??? (Do you have GPS coordinates?)

**❓ What I need from you:**
- What are the exact field names in your schools table?
- How are addresses stored? (one field with full address, or separate street/city/state/zip fields?)
- Do you have GPS coordinates stored, or just addresses?

---

## Questions for You to Answer

**Please fill out these answers so I can fix the smart fields:**

1. **Photographer Home Address:**
   - Database table: users
   - Field name(s): ________________________
   - Format: ________________________

2. **School Addresses:**
   - Database table: schools  
   - School name field: ________________________
   - Address field(s): ________________________
   - GPS coordinates field: ________________________

3. **Which smart fields do you actually want?**
   - ☐ Mileage calculator
   - ☐ Today's date
   - ☐ Current time  
   - ☐ Photographer name
   - ☐ School name
   - ☐ Photo count
   - ☐ GPS location
   - ☐ Weather

4. **Date/time formats you prefer:**
   - Date format: ________________________
   - Time format: ________________________

5. **Any other smart fields you want that aren't listed?**
   - ________________________