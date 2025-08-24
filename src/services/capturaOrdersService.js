// Captura Orders Service
// Uses Firebase Functions to fetch and manage orders from Captura API

import { capturaAuthService } from './capturaAuthService';
import { readCounter } from './readCounter';

class CapturaOrdersService {
  // Get orders from Captura API via Firebase Functions
  async getOrders(options = {}) {
    try {
      // Record the API read operation
      readCounter.recordRead('captura-api', 'orders', 'CapturaOrdersService', 50);

      // Extract filter parameters from options
      const {
        start = 1,
        end = 500, // Increased default to handle more orders
        orderStartDate,
        orderEndDate,
        orderType,
        paymentStatus
      } = options;

      // Build request parameters
      const params = {
        start,
        end
      };

      // Add filter parameters if provided
      if (orderStartDate) params.orderStartDate = orderStartDate;
      if (orderEndDate) params.orderEndDate = orderEndDate;
      if (orderType) params.orderType = orderType;
      if (paymentStatus) params.paymentStatus = paymentStatus;

      console.log('Fetching orders with params:', params);

      // Call Firebase Function with parameters
      const response = await capturaAuthService.makeAuthenticatedRequest('getCapturaOrders', params);

      console.log('Captura orders response:', response);

      // Transform the response to ensure consistent format
      return this.transformOrdersResponse(response);
    } catch (error) {
      console.error('Error fetching Captura orders:', error);
      readCounter.recordError('captura-api', 'CapturaOrdersService', error.message);
      
      // Return empty result instead of throwing to prevent app crashes
      if (error.code === 'functions/internal' || error.message.includes('INTERNAL')) {
        console.warn('Captura API temporarily unavailable, returning empty results');
        return {
          success: true,
          data: [],
          orders: [],
          pagination: { total: 0, start: 1, end: 0 },
          message: 'Captura API temporarily unavailable'
        };
      }
      
      throw error;
    }
  }

  // Get single order details
  async getOrderById(orderId) {
    try {
      readCounter.recordRead('captura-api', 'order-detail', 'CapturaOrdersService', 1);

      // Call Firebase Function
      const response = await capturaAuthService.makeAuthenticatedRequest('getCapturaOrder', {
        orderId
      });

      console.log('Single order API response:', response);
      console.log('=== Raw API Gallery Data Debug ===');
      if (response.galleryOrders) {
        console.log('Raw galleryOrders from API:', response.galleryOrders);
        response.galleryOrders.forEach((go, idx) => {
          console.log(`Raw Gallery Order ${idx}:`, {
            id: go.id,
            galleryID: go.galleryID,
            gallery: go.gallery,
            hasGallery: !!go.gallery,
            allFields: Object.keys(go)
          });
        });
      }
      
      // Check if response has the same structure as list response
      if (response.orders && Array.isArray(response.orders) && response.orders.length > 0) {
        // Single order API returned same structure as list - extract first order
        const order = response.orders[0];
        const transformed = this.transformOrder({
          ...order,
          billTo: response.billTo,
          shipTo: response.shipTo,
          accountID: response.accountID
        }, response); // Pass full response as second parameter
        console.log('Transformed order from array structure:', transformed);
        return transformed;
      } else {
        // Single order API returned the order directly
        const transformed = this.transformOrder(response, response); // Pass full response as second parameter
        console.log('Transformed order from direct structure:', transformed);
        return transformed;
      }
    } catch (error) {
      console.error('Error fetching Captura order:', error);
      readCounter.recordError('captura-api', 'CapturaOrdersService', error.message);
      throw error;
    }
  }

  // Get order statistics - DISABLED: Captura API doesn't have a statistics endpoint
  async getOrderStatistics(dateRange = 'month') {
    // Statistics endpoint doesn't exist in Captura API
    // TODO: Implement by fetching orders and calculating stats locally
    throw new Error('Statistics endpoint not available in Captura API');
    
    /* Original implementation commented out:
    try {
      readCounter.recordRead('captura-api', 'order-stats', 'CapturaOrdersService', 1);

      // Call Firebase Function
      const response = await capturaAuthService.makeAuthenticatedRequest('getCapturaOrderStats', {
        dateRange
      });

      return response;
    } catch (error) {
      console.error('Error fetching order statistics:', error);
      readCounter.recordError('captura-api', 'CapturaOrdersService', error.message);
      throw error;
    }
    */
  }

  // Transform orders response to consistent format
  transformOrdersResponse(response) {
    // Store the original response for reference
    const originalApiResponse = response;
    
    // The Captura API returns a structure with billTo, shipTo, and orders array
    if (response.orders && Array.isArray(response.orders)) {
      // This is the actual Captura response format
      const orders = response.orders.map(order => {
        // Merge the parent billTo/shipTo data with each order
        return this.transformOrder({
          ...order,
          billTo: response.billTo,
          shipTo: response.shipTo,
          accountID: response.accountID
        }, originalApiResponse); // Pass full original response
      });
      
      return {
        orders,
        pagination: {
          currentPage: 1,
          pageSize: orders.length,
          totalPages: 1,
          totalCount: response.total || orders.length // Use total from API if available
        },
        // Include the original API response for debugging
        originalApiResponse
      };
    }
    
    // Fallback for other possible formats
    const orders = response.data || response.items || [];
    const totalCount = response.totalCount || response.total || orders.length;
    const pageInfo = {
      currentPage: response.currentPage || response.page || 1,
      pageSize: response.pageSize || orders.length,
      totalPages: response.totalPages || Math.ceil(totalCount / (response.pageSize || orders.length)),
      totalCount
    };

    return {
      orders: Array.isArray(orders) ? orders.map(order => this.transformOrder(order, originalApiResponse)) : [],
      pagination: pageInfo,
      originalApiResponse
    };
  }

  // Transform individual order to consistent format
  transformOrder(order, fullApiResponse = null) {
    if (!order) {
      console.error('transformOrder: No order data provided');
      return null;
    }
    
    // Extract customer info from billTo
    const customerName = order.billTo 
      ? `${order.billTo.firstName || ''} ${order.billTo.lastName || ''}`.trim()
      : 'Unknown Customer';
    
    // Extract gallery info and student names
    const galleryOrders = order.galleryOrders || [];
    const firstGallery = galleryOrders[0]?.gallery;
    const galleryName = firstGallery?.title || 'No Gallery';
    
    // Get all student names from the order
    const studentNames = galleryOrders
      .map(go => {
        if (go.studentIdentifier) return go.studentIdentifier;
        if (go.subject?.firstName || go.subject?.lastName) {
          return `${go.subject?.firstName || ''} ${go.subject?.lastName || ''}`.trim();
        }
        return '';
      })
      .filter(name => name && name !== ' ')
      .join(', ');
    
    // Format the order number
    const orderNumber = order.id ? `#${order.id}` : 'Unknown';
    
    return {
      id: order.id,
      orderNumber,
      customerName,
      customerEmail: order.billTo?.email || '',
      customerPhone: order.billTo?.phone || '',
      orderDate: order.orderDate,
      status: order.orderStatus || order.status || 'pending',
      paymentStatus: order.paymentStatus || 'pending',
      paymentType: order.paymentType,
      total: order.total || 0,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      shipping: order.shipping || 0,
      handling: order.handling || 0,
      discount: order.discount || 0,
      discountCode: order.discountCode || '',
      commission: order.commission || 0,
      transactionFee: order.transactionFee || 0,
      currency: order.currency || 'USD',
      
      // Gallery and student info
      galleryName,
      galleryId: firstGallery?.id,
      studentNames,
      galleryOrders: galleryOrders.map(go => ({
        id: go.id,
        galleryID: go.galleryID,
        subjectID: go.subjectID,
        studentName: go.studentIdentifier,
        customData: go.customData || {},
        subject: go.subject || {},
        gallery: go.gallery || {},
        priceSheetName: go.priceSheetName || '',
        priceSheetRefID: go.priceSheetRefID || ''
      })),
      
      // Addresses - map API schema fields to our expected format
      billTo: order.billTo ? {
        firstName: order.billTo.firstName || '',
        lastName: order.billTo.lastName || '',
        email: order.billTo.email || '',
        phone: order.billTo.phone || '',
        address: order.billTo.address1 || '', // API uses address1
        address2: order.billTo.address2 || '',
        city: order.billTo.city || '',
        state: order.billTo.state || '',
        zipCode: order.billTo.zip || '', // API uses zip not zipCode
        country: order.billTo.country || ''
      } : {},
      shipTo: order.shipTo ? {
        firstName: order.shipTo.firstName || '',
        lastName: order.shipTo.lastName || '',
        email: order.shipTo.email || '',
        phone: order.shipTo.phone || '',
        address: order.shipTo.address1 || '', // API uses address1
        address2: order.shipTo.address2 || '',
        city: order.shipTo.city || '',
        state: order.shipTo.state || '',
        zipCode: order.shipTo.zip || '', // API uses zip not zipCode
        country: order.shipTo.country || ''
      } : {},
      
      // Items and services
      items: this.transformOrderItems(order.items || [], order.galleryOrders || []),
      itemsByStudent: this.groupItemsByStudent(order.items || [], order.galleryOrders || []),
      serviceOrders: (order.serviceOrders || []).map(so => ({
        id: so.id,
        serviceID: so.serviceID,
        name: so.name || '',
        status: so.status || so.orderStatus || 'new',
        orderStatus: so.orderStatus || 'new',
        renderStatus: so.renderStatus || '',
        labOrderID: so.labOrderID || '',
        shipVia: so.shipVia || '',
        printFee: so.printFee || 0,
        shippingFee: so.shippingFee || 0,
        notes: so.notes || '',
        orderDate: so.orderDate || '',
        releaseDate: so.releaseDate || ''
      })),
      
      // Additional info
      notes: order.notes || '',
      merchantID: order.merchantID,
      merchant: order.merchant?.name || order.merchant || '',
      accountID: order.accountID,
      custID: order.custID || '',
      isBatchOrder: order.isBatchOrder || false,
      orderType: order.orderType || '',
      shipmentType: order.shipmentType || '',
      paymentStatusDate: order.paymentStatusDate || '',
      
      // Additional financial fields from API
      digitalProductFee: order.digitalProductFee || 0,
      photogNet: order.photogNet || 0,
      processingFee: order.processingFee || 0,
      labPrintingFee: order.labPrintingFee || 0,
      labShippingFee: order.labShippingFee || 0,
      netPay: order.netPay || 0,
      backgroundFee: order.backgroundFee || 0,
      amountRefunded: order.amountRefunded || 0,
      
      // Preserve the raw order data for debugging/viewing
      rawData: order,
      // Preserve the full API response if available
      fullApiResponse: fullApiResponse || order
    };
  }

  // Transform order items to consistent format
  transformOrderItems(items, galleryOrders = []) {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => {
      // Find the associated gallery order for student info
      const galleryOrder = galleryOrders.find(go => go.id === item.galleryOrderID);
      // Handle complex item structure from API
      const productName = item.name || 
                         item.catalogProduct?.name || 
                         item.fulfillmentProduct?.name || 
                         item.layoutProduct?.name || 
                         'Unknown Product';
      
      const productId = item.catalogProductID || 
                       item.fulfillmentProductID || 
                       item.layoutProductID || 
                       item.id;
      
      // Extract display image from various possible locations
      const imageUrl = item.catalogProduct?.displayImage || 
                      item.fulfillmentProduct?.displayImage || 
                      item.layoutProduct?.displayImage || 
                      '';
      
      // Transform options to simpler format
      const options = (item.options || []).map(opt => 
        opt.value || `${opt.name}: ${opt.catalogValue || ''}`
      ).filter(Boolean);
      
      return {
        id: item.id,
        productName,
        productId,
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        total: item.total || (item.quantity * (item.unitPrice || 0)) || 0,
        imageUrl,
        options,
        type: item.type || '',
        sku: item.catalogProduct?.sku || item.fulfillmentProduct?.sku || '',
        notes: item.notes || '',
        // Add student info if available
        galleryOrderID: item.galleryOrderID,
        studentName: galleryOrder?.studentIdentifier || '',
        studentInfo: galleryOrder ? {
          name: galleryOrder.studentIdentifier,
          firstName: galleryOrder.subject?.firstName,
          lastName: galleryOrder.subject?.lastName,
          grade: galleryOrder.subject?.grade,
          teacher: galleryOrder.subject?.teacher,
          subjectID: galleryOrder.subjectID
        } : null,
        // For packages, include sub-items
        packageItems: item.items || []
      };
    });
  }

  // Group items by student for multi-student orders
  groupItemsByStudent(items, galleryOrders) {
    if (!items || !Array.isArray(items) || !galleryOrders || !Array.isArray(galleryOrders)) {
      return [];
    }

    console.log('=== groupItemsByStudent Debug ===');
    console.log('Gallery Orders:', galleryOrders);
    console.log('Gallery Orders count:', galleryOrders.length);

    // Create a map of gallery order ID to student info
    const studentMap = {};
    galleryOrders.forEach((go, index) => {
      console.log(`Gallery Order ${index}:`, {
        id: go.id,
        studentIdentifier: go.studentIdentifier,
        subject: go.subject,
        gallery: go.gallery,
        galleryID: go.galleryID,
        hasGalleryObject: !!go.gallery,
        galleryTitle: go.gallery?.title,
        galleryName: go.gallery?.name
      });
      // Determine student name using same logic as transformOrder
      let studentName = go.studentIdentifier;
      if (!studentName && (go.subject?.firstName || go.subject?.lastName)) {
        studentName = `${go.subject?.firstName || ''} ${go.subject?.lastName || ''}`.trim();
      }
      if (!studentName || studentName === '') {
        studentName = 'Unknown Student';
      }
      
      studentMap[go.id] = {
        galleryOrderID: go.id,
        studentName: studentName,
        firstName: go.subject?.firstName || '',
        lastName: go.subject?.lastName || '',
        grade: go.subject?.grade || '',
        teacher: go.subject?.teacher || '',
        homeRoom: go.subject?.homeRoom || '',
        subjectID: go.subjectID,
        galleryName: go.gallery?.title || go.gallery?.name || '',
        galleryID: go.galleryID,
        items: [],
        subtotal: 0
      };
    });

    // Group items by gallery order ID
    items.forEach(item => {
      if (item.galleryOrderID && studentMap[item.galleryOrderID]) {
        const transformedItem = {
          id: item.id,
          name: item.name,
          type: item.type,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          total: item.total || 0,
          packageItems: item.items || []
        };
        
        studentMap[item.galleryOrderID].items.push(transformedItem);
        studentMap[item.galleryOrderID].subtotal += transformedItem.total;
      }
    });

    // Convert map to array and filter out students with no items
    return Object.values(studentMap).filter(student => student.items.length > 0);
  }

  // Search orders - Note: The API doesn't support direct search, would need to be implemented client-side
  async searchOrders(searchTerm, options = {}) {
    // For now, just get orders and filter client-side in the component
    return this.getOrders(options);
  }

  // Get orders by payment status
  async getOrdersByPaymentStatus(paymentStatus, options = {}) {
    return this.getOrders({
      ...options,
      paymentStatus: paymentStatus || undefined
    });
  }

  // Get orders by date range
  async getOrdersByDateRange(startDate, endDate, options = {}) {
    const params = { ...options };
    
    // Convert dates to YYYY-MM-DD format if provided
    if (startDate) {
      params.orderStartDate = typeof startDate === 'string' 
        ? startDate 
        : startDate.toISOString().split('T')[0];
    }
    if (endDate) {
      // Add one day to end date to make it inclusive (API treats end date as exclusive)
      let adjustedEndDate;
      if (typeof endDate === 'string') {
        // Parse the string date, add one day
        const dateObj = new Date(endDate);
        dateObj.setDate(dateObj.getDate() + 1);
        adjustedEndDate = dateObj.toISOString().split('T')[0];
      } else {
        // Date object - add one day
        const dateObj = new Date(endDate);
        dateObj.setDate(dateObj.getDate() + 1);
        adjustedEndDate = dateObj.toISOString().split('T')[0];
      }
      params.orderEndDate = adjustedEndDate;
      
      console.log(`Adjusted end date from ${endDate} to ${adjustedEndDate} for inclusive range`);
    }
    
    return this.getOrders(params);
  }
  
  // Get orders by type
  async getOrdersByType(orderType, options = {}) {
    return this.getOrders({
      ...options,
      orderType
    });
  }
}

// Export singleton instance
export const capturaOrdersService = new CapturaOrdersService();