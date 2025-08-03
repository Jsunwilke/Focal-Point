# Captura API Integration Setup

This document explains how to configure and deploy the Captura API integration using Firebase Functions.

## Overview

The Orders feature integrates with the Captura API to fetch and display order information. To avoid CORS issues, all API calls are proxied through Firebase Functions.

## Environment Configuration

### Option 1: Using Firebase Functions Config (Recommended for Production)

Set the Captura API credentials using Firebase CLI:

```bash
# Set Captura API credentials
firebase functions:config:set captura.client_id="YOUR_CLIENT_ID"
firebase functions:config:set captura.client_secret="YOUR_CLIENT_SECRET"
firebase functions:config:set captura.account_id="YOUR_ACCOUNT_ID"

# View current configuration
firebase functions:config:get

# Deploy the configuration
firebase deploy --only functions
```

### Option 2: Using Environment Variables (Development)

For local development, you can set environment variables in the functions directory:

1. Create a `.env` file in the `functions/` directory
2. Add the following variables:

```env
CAPTURA_CLIENT_ID=your_client_id
CAPTURA_CLIENT_SECRET=your_client_secret
CAPTURA_ACCOUNT_ID=your_account_id
```

**Note**: The functions already have default values for these credentials, but you should update them with your own for production use.

## Deployment

### Deploy Firebase Functions

```bash
# Deploy only the Captura functions
firebase deploy --only functions:getCapturaOrders,functions:getCapturaOrder,functions:getCapturaOrderStats

# Or deploy all functions
firebase deploy --only functions
```

### Test Locally

```bash
# Start the Firebase emulator
cd functions
npm run serve

# The functions will be available at:
# http://localhost:5001/YOUR_PROJECT_ID/us-central1/getCapturaOrders
```

## Functions Overview

### 1. `getCapturaOrders`
Fetches a paginated list of orders from Captura.

**Parameters:**
- `page` (number): Page number (default: 1)
- `pageSize` (number): Items per page (default: 50)
- `sortBy` (string): Sort field (default: 'orderDate')
- `sortOrder` (string): Sort direction 'asc' or 'desc' (default: 'desc')
- `status` (string): Filter by order status
- `startDate` (string): Filter by start date (YYYY-MM-DD)
- `endDate` (string): Filter by end date (YYYY-MM-DD)
- `searchTerm` (string): Search orders

### 2. `getCapturaOrder`
Fetches details for a single order.

**Parameters:**
- `orderId` (string): The Captura order ID

### 3. `getCapturaOrderStats`
Fetches order statistics for a date range.

**Parameters:**
- `dateRange` (string): Statistics period ('day', 'week', 'month', 'year')

## Security

- All functions require Firebase Authentication
- API credentials are stored securely in Firebase Functions config
- OAuth tokens are cached server-side to minimize API calls
- CORS is properly configured for your domain

## Troubleshooting

### CORS Errors
If you see CORS errors, ensure:
1. Firebase Functions are deployed
2. You're using the correct Firebase project
3. The frontend is calling Firebase Functions, not the Captura API directly

### Authentication Errors
If you see authentication errors:
1. Check that the Captura credentials are correctly set
2. Verify the account ID matches your Captura account
3. Ensure the credentials have the necessary permissions

### No Orders Showing
If no orders appear:
1. Check the browser console for errors
2. Verify Firebase Functions are returning data
3. Check that your Captura account has orders
4. Ensure the date range filters aren't too restrictive

## Support

For issues with:
- **Firebase Functions**: Check the Functions logs in Firebase Console
- **Captura API**: Contact Captura support
- **Application Code**: Check the error messages in the browser console