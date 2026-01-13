const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { TaxEntry, TaxSlab } = require('../models/Tax');

// Try to import Order model (optional)
let Order;
try {
  Order = require('../models/Order');
} catch (error) {
  console.log('Order model not found, payment alerts will be disabled');
  Order = null;
}

// Helper functions
const generateNotificationHash = (notificationData) => {
  // Create a consistent hash based on key identifying fields
  const type = notificationData.type || '';
  const productId = notificationData.productId || '';
  const orderId = notificationData.orderId || '';
  const taxId = notificationData.taxId || '';
  const invoiceNo = notificationData.invoiceNo || notificationData.invoiceNumber || '';
  const customerName = notificationData.customerName || notificationData.customer || '';
  const billNumber = notificationData.billNumber || '';
  const gstin = notificationData.gstin || '';
  
  const hashString = `${type}_${productId}_${orderId}_${taxId}_${invoiceNo}_${customerName}_${billNumber}_${gstin}`.toLowerCase();
  return crypto.createHash('md5').update(hashString).digest('hex');
};

// ✅ ENHANCED: Intelligently upsert notification with proper event emission
const upsertNotification = async (notificationData, io = null, source = 'system') => {
  try {
    const notificationHash = notificationData.notificationHash || generateNotificationHash(notificationData);
    
    // Check if notification already exists (within last 30 days to avoid stale data)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const existingNotification = await Notification.findOne({ 
      notificationHash: notificationHash,
      timestamp: { $gte: thirtyDaysAgo }
    });
    
    if (existingNotification) {
      // Check if data has actually changed
      const hasChanges = 
        existingNotification.currentStock !== notificationData.currentStock ||
        existingNotification.amount !== notificationData.amount ||
        existingNotification.daysSince !== notificationData.daysSince ||
        existingNotification.priority !== notificationData.priority ||
        existingNotification.type !== notificationData.type ||
        existingNotification.message !== notificationData.message ||
        existingNotification.title !== notificationData.title ||
        existingNotification.isRead !== notificationData.isRead ||
        existingNotification.isResolved !== notificationData.isResolved ||
        existingNotification.color !== notificationData.color ||
        existingNotification.paymentMode !== notificationData.paymentMode ||
        existingNotification.customerPhone !== notificationData.customerPhone ||
        existingNotification.invoiceNumber !== notificationData.invoiceNumber;
      
      if (hasChanges) {
        console.log(`🔄 [${source}] Data changed for notification: ${notificationData.title}`);
        console.log(`   Hash: ${notificationHash}`);
        
        const updatedNotification = await Notification.findOneAndUpdate(
          { _id: existingNotification._id },
          {
            ...notificationData,
            lastUpdated: new Date(),
            updatedBy: source,
            // Preserve original timestamp for new notifications, update for modifications
            timestamp: notificationData.preserveTimestamp ? existingNotification.timestamp : new Date()
          },
          { new: true, runValidators: true }
        );
        
        console.log(`🔄 [${source}] Updated notification: ${updatedNotification.title} (ID: ${updatedNotification._id})`);
        
        // ✅ BROADCAST: Emit update event to ALL connected clients
        if (io) {
          io.emit('notification_updated', {
            notification: updatedNotification,
            action: 'updated',
            oldId: existingNotification._id,
            source: source,
            notificationHash: notificationHash,
            timestamp: new Date().toISOString()
          });
          console.log(`📡 [${source}] Broadcasted 'notification_updated' event to all clients`);
        }
        
        return { 
          notification: updatedNotification, 
          isNew: false, 
          updated: true,
          action: 'updated'
        };
      } else {
        console.log(`⏭️  [${source}] Skipped unchanged notification: ${existingNotification.title} (ID: ${existingNotification._id})`);
        return { 
          notification: existingNotification, 
          isNew: false, 
          updated: false,
          action: 'unchanged'
        };
      }
    } else {
      // Create new notification
      const newNotification = new Notification({
        ...notificationData,
        notificationHash: notificationHash,
        timestamp: new Date(),
        lastUpdated: new Date(),
        createdBy: source,
        isResolved: false
      });
      
      await newNotification.save();
      console.log(`✅ [${source}] Created new notification: ${newNotification.title} (ID: ${newNotification._id}, Hash: ${notificationHash})`);
      
      // ✅ BROADCAST: Emit creation event to ALL connected clients
      if (io) {
        io.emit('notification_created', {
          notification: newNotification,
          action: 'created',
          source: source,
          notificationHash: notificationHash,
          timestamp: new Date().toISOString()
        });
        console.log(`📡 [${source}] Broadcasted 'notification_created' event to all clients`);
      }
      
      return { 
        notification: newNotification, 
        isNew: true, 
        updated: false,
        action: 'created'
      };
    }
  } catch (error) {
    console.error(`❌ [${source}] Error upserting notification:`, error.message);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      console.log(`🔄 [${source}] Duplicate key error, recovering existing notification`);
      const existingNotification = await Notification.findOne({ 
        notificationHash: error.keyValue.notificationHash 
      });
      
      if (existingNotification) {
        console.log(`🔄 [${source}] (Recovery) Using existing notification: ${existingNotification.title}`);
        return { 
          notification: existingNotification, 
          isNew: false, 
          updated: false,
          action: 'recovered'
        };
      }
    }
    throw error;
  }
};

// ✅ FIXED: Get all notifications with GST and payment alerts
router.get('/', async (req, res) => {
  try {
    // CRITICAL FIX: Only get UNRESOLVED notifications from database
    const storedNotifications = await Notification.find({ 
      isResolved: false 
    })
    .sort({ timestamp: -1 })
    .limit(100);
    
    console.log(`📦 Found ${storedNotifications.length} stored unresolved notifications`);
    
    // Use Map for efficient deduplication by hash
    const notificationMap = new Map();
    
    // Add stored notifications first (they have priority)
    storedNotifications.forEach(notification => {
      const hash = notification.notificationHash || generateNotificationHash(notification);
      if (!notificationMap.has(hash)) {
        notificationMap.set(hash, notification.toObject ? notification.toObject() : notification);
      } else {
        console.log(`⚠️ Duplicate notification skipped by hash: ${notification.title}`);
      }
    });
    
    try {
      // Generate GST alerts (only add if not already exists)
      const gstAlerts = await generateGSTAlerts(req.io);
      gstAlerts.forEach(alert => {
        const hash = alert.notificationHash || generateNotificationHash(alert);
        if (!notificationMap.has(hash)) {
          notificationMap.set(hash, alert);
        } else {
          console.log(`⚠️ GST alert duplicate skipped: ${alert.title}`);
        }
      });
    } catch (gstError) {
      console.error('Error generating GST alerts:', gstError.message);
    }
    
    try {
      // Generate payment alerts (only add if not already exists)
      const paymentAlerts = await generatePaymentAlerts(req.io);
      paymentAlerts.forEach(alert => {
        const hash = alert.notificationHash || generateNotificationHash(alert);
        if (!notificationMap.has(hash)) {
          notificationMap.set(hash, alert);
        } else {
          console.log(`⚠️ Payment alert duplicate skipped: ${alert.title}`);
        }
      });
    } catch (paymentError) {
      console.error('Error generating payment alerts:', paymentError.message);
    }
    
    // CRITICAL: Double-filter to remove any resolved notifications
    let uniqueNotifications = Array.from(notificationMap.values())
      .filter(n => !n.isResolved);
    
    // Sort by timestamp (newest first)
    uniqueNotifications.sort((a, b) => {
      const dateA = new Date(b.timestamp || b.createdAt || 0);
      const dateB = new Date(a.timestamp || a.createdAt || 0);
      return dateA - dateB;
    });
    
    console.log(`📊 Returning ${uniqueNotifications.length} unique unresolved notifications`);
    
    res.json(uniqueNotifications);
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

// ✅ NEW: API to update notification from any page
router.post('/update-from-page', async (req, res) => {
  try {
    const { 
      notificationData, 
      source = 'unknown_page',
      preserveTimestamp = false 
    } = req.body;
    
    console.log(`📝 Update request from ${source}:`, {
      title: notificationData.title,
      type: notificationData.type
    });
    
    if (!notificationData || !notificationData.type) {
      return res.status(400).json({ error: 'Notification data is required' });
    }
    
    // Add preserveTimestamp flag to notification data
    const dataWithFlag = {
      ...notificationData,
      preserveTimestamp: preserveTimestamp
    };
    
    const result = await upsertNotification(dataWithFlag, req.io, source);
    
    res.json({
      success: true,
      action: result.action,
      notification: result.notification,
      message: result.action === 'created' ? 'Notification created' : 
               result.action === 'updated' ? 'Notification updated' : 
               'No changes needed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error updating notification from page:', error);
    res.status(500).json({ 
      error: 'Error updating notification',
      details: error.message 
    });
  }
});

// Get only stock alerts (for stock alerts page)
router.get('/stock-alerts', async (req, res) => {
  try {
    const stockNotifications = await Notification.find({ 
      isResolved: false,
      type: { $in: ['Low Stock', 'Out of Stock'] }
    })
    .sort({ priority: -1, timestamp: -1 });
    
    console.log(`📦 Returning ${stockNotifications.length} stock alerts`);
    
    const stockAlerts = stockNotifications.map(n => {
      const alert = n.toObject ? n.toObject() : n;
      return alert;
    });
    
    res.json(stockAlerts);
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    res.status(500).json({ error: 'Error fetching stock alerts' });
  }
});

// ✅ ENHANCED: Generate GST alerts from tax entries
const generateGSTAlerts = async (io = null) => {
  try {
    const alerts = [];
    const now = new Date();
    
    let taxEntries = [];
    try {
      taxEntries = await TaxEntry.find({
        $or: [
          { status: { $regex: /pending/i } },
          { status: { $regex: /draft/i } },
          { status: { $in: ['pending', 'draft', 'Pending', 'Draft'] } }
        ]
      }).sort({ date: -1 }).limit(20);
      
      console.log(`🔍 Found ${taxEntries.length} pending/draft tax entries for GST alerts`);
      
    } catch (error) {
      console.log('❌ Could not fetch tax entries:', error.message);
      return alerts;
    }
    
    for (const tax of taxEntries) {
      if (!tax || !tax._id) continue;
      
      const taxDate = new Date(tax.date || tax.createdAt || now);
      const daysSinceEntry = Math.floor((now - taxDate) / (1000 * 60 * 60 * 24));
      const taxAmount = parseFloat(tax.totalTax || tax.totalAmount || 0);
      const isHighValue = taxAmount >= 10000;
      
      let alertTitle, priority, color, messagePrefix;
      
      if (daysSinceEntry >= 7) {
        alertTitle = 'GST Payment Overdue!';
        priority = 'high';
        color = 'red';
        messagePrefix = `GST payment overdue for ${daysSinceEntry} days`;
      } else if (daysSinceEntry >= 3) {
        alertTitle = 'GST Payment Due Soon';
        priority = 'medium';
        color = 'orange';
        messagePrefix = `GST payment due in ${7 - daysSinceEntry} days`;
      } else {
        alertTitle = 'GST Payment Pending';
        priority = 'medium';
        color = 'blue';
        messagePrefix = `GST payment pending (${daysSinceEntry} days)`;
      }
      
      const notificationData = {
        type: 'GST Alert',
        title: alertTitle,
        message: `${messagePrefix} for invoice ${tax.invoiceNo || tax._id}. Customer: ${tax.customer || 'Unknown'}`,
        taxId: tax._id.toString(),
        invoiceNo: tax.invoiceNo || `TAX-${tax._id}`,
        customer: tax.customer || 'Unknown Customer',
        gstin: tax.gstin || 'N/A',
        amount: taxAmount,
        isHighValue: isHighValue,
        daysSince: daysSinceEntry,
        status: tax.status || 'Unknown',
        timestamp: taxDate,
        isRead: false,
        color: color,
        icon: 'FileText',
        priority: isHighValue ? 'high' : priority,
        isResolved: false
      };
      
      try {
        const result = await upsertNotification(notificationData, io, 'gst_service');
        
        if (result.action === 'created' || result.action === 'updated') {
          alerts.push(result.notification);
        }
      } catch (error) {
        console.error(`❌ Error processing GST alert for tax ${tax._id}:`, error.message);
        continue;
      }
    }
    
    // Mark GST alerts as resolved for paid tax entries
    const paidTaxEntries = await TaxEntry.find({
      status: { $regex: /paid|completed|done/i }
    });
    
    for (const tax of paidTaxEntries) {
      const notificationHash = generateNotificationHash({
        type: 'GST Alert',
        taxId: tax._id.toString()
      });
      
      const existingAlerts = await Notification.find({
        notificationHash: notificationHash,
        isResolved: false
      });
      
      if (existingAlerts.length > 0) {
        console.log(`🔄 Resolving ${existingAlerts.length} GST alerts for paid tax ${tax._id}`);
        
        await Notification.updateMany(
          {
            notificationHash: notificationHash,
            isResolved: false
          },
          {
            isResolved: true,
            isRead: true,
            resolutionNote: `GST payment marked as ${tax.status}`,
            resolvedAt: new Date(),
            lastUpdated: new Date()
          }
        );
        
        // Emit resolution events
        if (io) {
          existingAlerts.forEach(alert => {
            io.emit('notification_resolved', {
              notificationId: alert._id.toString(),
              notificationHash: notificationHash,
              resolutionNote: `GST payment marked as ${tax.status}`,
              source: 'gst_service',
              timestamp: new Date().toISOString()
            });
          });
        }
      }
    }
    
    console.log(`📊 Processed ${alerts.length} GST alerts (created/updated)`);
    return alerts;
  } catch (error) {
    console.error('❌ Error in generateGSTAlerts:', error);
    return [];
  }
};

// ✅ ENHANCED: Generate payment alerts from orders
const generatePaymentAlerts = async (io = null) => {
  try {
    const alerts = [];
    const now = new Date();
    
    if (!Order) {
      console.log('⚠️ Order model not available');
      return alerts;
    }
    
    let orders = [];
    try {
      orders = await Order.find({
        paymentStatus: { 
          $in: ['pending', 'Pending', 'PENDING', 'due', 'Due', 'DUE', 'overdue', 'Overdue', 'OVERDUE'] 
        }
      }).sort({ date: -1 }).limit(20);
      
      console.log(`🔍 Found ${orders.length} pending payment orders for payment alerts`);
      
    } catch (error) {
      console.log('❌ Could not fetch orders:', error.message);
      return alerts;
    }
    
    for (const order of orders) {
      if (!order || !order.orderId) continue;
      
      const orderDate = new Date(order.date || order.createdAt || now);
      const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
      const orderAmount = parseFloat(order.totalAmount || order.amount || 0);
      const isHighValue = orderAmount >= 5000;
      
      let alertTitle, priority, color, messagePrefix;
      
      if (daysSinceOrder >= 7) {
        alertTitle = isHighValue ? '⚠️ High-Value Payment Severely Overdue!' : 'Payment Severely Overdue!';
        priority = 'high';
        color = 'red';
        messagePrefix = `Payment severely overdue for ${daysSinceOrder} days`;
      } else if (daysSinceOrder >= 3) {
        alertTitle = isHighValue ? '⚠️ High-Value Payment Overdue' : 'Payment Overdue';
        priority = isHighValue ? 'high' : 'medium';
        color = 'orange';
        messagePrefix = `Payment overdue for ${daysSinceOrder} days`;
      } else {
        alertTitle = isHighValue ? '⚠️ High-Value Payment Pending' : 'Payment Pending';
        priority = isHighValue ? 'medium' : 'medium';
        color = 'blue';
        messagePrefix = `Payment pending for ${daysSinceOrder} days`;
      }
      
      const notificationData = {
        type: 'Payment Alert',
        title: alertTitle,
        message: `${messagePrefix}. Customer: ${order.customerName || 'Unknown'}. Amount: ₹${orderAmount.toLocaleString()}`,
        orderId: order.orderId,
        billNumber: order.billNumber || order.invoiceNumber || `ORD-${order.orderId}`,
        customerName: order.customerName || 'Unknown Customer',
        customerPhone: order.customerPhone || order.phone || 'N/A',
        amount: orderAmount,
        paymentMode: order.paymentMode || 'Unknown',
        invoiceNumber: order.billNumber || order.invoiceNumber || `INV-${order.orderId}`,
        paymentStatus: order.paymentStatus || 'Unknown',
        isHighValue: isHighValue,
        daysSince: daysSinceOrder,
        timestamp: orderDate,
        isRead: false,
        color: color,
        icon: isHighValue ? 'DollarSign' : 'CreditCard',
        priority: priority,
        isResolved: false
      };
      
      try {
        const result = await upsertNotification(notificationData, io, 'payment_service');
        
        if (result.action === 'created' || result.action === 'updated') {
          alerts.push(result.notification);
        }
      } catch (error) {
        console.error(`❌ Error processing payment alert for order ${order.orderId}:`, error.message);
        continue;
      }
    }
    
    // Mark payment alerts as resolved for paid orders
    const paidOrders = await Order.find({
      paymentStatus: { $regex: /paid|completed|done/i }
    });
    
    for (const order of paidOrders) {
      const notificationHash = generateNotificationHash({
        type: 'Payment Alert',
        orderId: order.orderId
      });
      
      const existingAlerts = await Notification.find({
        notificationHash: notificationHash,
        isResolved: false
      });
      
      if (existingAlerts.length > 0) {
        console.log(`🔄 Resolving ${existingAlerts.length} payment alerts for paid order ${order.orderId}`);
        
        await Notification.updateMany(
          {
            notificationHash: notificationHash,
            isResolved: false
          },
          {
            isResolved: true,
            isRead: true,
            resolutionNote: `Payment marked as ${order.paymentStatus}`,
            resolvedAt: new Date(),
            lastUpdated: new Date()
          }
        );
        
        // Emit resolution events
        if (io) {
          existingAlerts.forEach(alert => {
            io.emit('notification_resolved', {
              notificationId: alert._id.toString(),
              notificationHash: notificationHash,
              resolutionNote: `Payment marked as ${order.paymentStatus}`,
              source: 'payment_service',
              timestamp: new Date().toISOString()
            });
          });
        }
      }
    }
    
    console.log(`📊 Processed ${alerts.length} payment alerts (created/updated)`);
    return alerts;
  } catch (error) {
    console.error('❌ Error in generatePaymentAlerts:', error);
    return [];
  }
};

// Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const storedNotifications = await Notification.find({ isResolved: false });
    
    // Use Map for deduplication in stats too
    const notificationMap = new Map();
    
    storedNotifications.forEach(notification => {
      const hash = notification.notificationHash || generateNotificationHash(notification);
      if (!notificationMap.has(hash)) {
        notificationMap.set(hash, notification);
      }
    });
    
    const gstAlerts = await generateGSTAlerts(req.io);
    gstAlerts.forEach(alert => {
      const hash = alert.notificationHash || generateNotificationHash(alert);
      if (!notificationMap.has(hash)) {
        notificationMap.set(hash, alert);
      }
    });
    
    const paymentAlerts = await generatePaymentAlerts(req.io);
    paymentAlerts.forEach(alert => {
      const hash = alert.notificationHash || generateNotificationHash(alert);
      if (!notificationMap.has(hash)) {
        notificationMap.set(hash, alert);
      }
    });
    
    const uniqueNotifications = Array.from(notificationMap.values());
    
    const stockAlerts = uniqueNotifications.filter(n => 
      (n.type === 'Low Stock' || n.type === 'Out of Stock')
    );
    
    const gstAlertsList = uniqueNotifications.filter(n => n.type === 'GST Alert');
    const paymentAlertsList = uniqueNotifications.filter(n => n.type === 'Payment Alert');
    
    const unreadCount = uniqueNotifications.filter(n => !n.isRead).length;
    const lowStockCount = stockAlerts.filter(n => !n.isRead).length;
    const gstAlertCount = gstAlertsList.filter(n => !n.isRead).length;
    const paymentAlertCount = paymentAlertsList.filter(n => !n.isRead).length;
    
    res.json({
      unreadCount,
      lowStockCount,
      gstAlertCount,
      paymentAlertCount,
      totalNotifications: uniqueNotifications.length,
      breakdown: {
        stock: stockAlerts.length,
        gst: gstAlertsList.length,
        payment: paymentAlertsList.length,
        total: uniqueNotifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Error fetching notification statistics' });
  }
});

// ✅ FIXED: INTELLIGENT STOCK CHECK with enhanced event emission
router.post('/check-stock', async (req, res) => {
  try {
    const { productId, productName, currentStock, minStock } = req.body;
    
    console.log(`🔍 Stock Check for: ${productName}`);
    console.log(`   Product ID: ${productId}`);
    console.log(`   Current: ${currentStock}, Min: ${minStock}`);
    
    if (currentStock === undefined || minStock === undefined) {
      return res.status(400).json({ error: 'currentStock and minStock are required' });
    }
    
    // CASE 1: OUT OF STOCK (currentStock = 0)
    if (currentStock === 0) {
      console.log(`🚨 OUT OF STOCK: ${productName}`);
      
      const result = await upsertNotification({
        type: 'Out of Stock',
        title: 'Out of Stock Alert',
        message: `${productName} is completely out of stock`,
        productName,
        productId,
        currentStock,
        minStock,
        priority: 'high',
        color: 'red',
        icon: 'Package'
      }, req.io, 'stock_service');
      
      return res.json({ 
        status: result.action === 'created' ? 'alert_created' : 'alert_updated',
        notificationCreated: result.isNew,
        notificationUpdated: result.updated,
        notification: result.notification,
        action: result.action,
        message: result.action === 'created' ? 'Out of stock alert created' : 
                 result.action === 'updated' ? 'Out of stock alert updated' : 
                 'Out of stock alert already exists'
      });
    }
    
    // CASE 2: LOW STOCK (currentStock <= minStock but > 0)
    if (currentStock > 0 && currentStock <= minStock) {
      const priority = currentStock <= 2 ? 'high' : currentStock <= 5 ? 'medium' : 'low';
      
      console.log(`⚠️ LOW STOCK: ${productName} (Priority: ${priority})`);
      
      const result = await upsertNotification({
        type: 'Low Stock',
        title: currentStock <= 2 ? 'Critical Stock Alert' : 'Low Stock Warning',
        message: `${productName} stock is ${currentStock <= 2 ? 'critically' : ''} low (${currentStock} units remaining)`,
        productName,
        productId,
        currentStock,
        minStock,
        priority,
        color: currentStock <= 2 ? 'red' : 'orange',
        icon: 'Package'
      }, req.io, 'stock_service');
      
      return res.json({ 
        status: result.action === 'created' ? 'alert_created' : 'alert_updated',
        notificationCreated: result.isNew,
        notificationUpdated: result.updated,
        notification: result.notification,
        action: result.action,
        message: result.action === 'created' ? 'Low stock alert created' : 
                 result.action === 'updated' ? 'Low stock alert updated' : 
                 'Low stock alert already exists'
      });
    }
    
    // CASE 3: STOCK IS SUFFICIENT (currentStock > minStock)
    console.log(`✅ SUFFICIENT STOCK: ${productName} - Removing all alerts`);
    
    // Find all stock notifications for this product
    const existingNotifications = await Notification.find({
      productId: productId,
      type: { $in: ['Low Stock', 'Out of Stock'] },
      isResolved: false
    });
    
    if (existingNotifications.length > 0) {
      console.log(`   🗑️ Found ${existingNotifications.length} notifications to delete`);
      
      // DELETE the notifications completely from database
      const deleteResult = await Notification.deleteMany({
        productId: productId,
        type: { $in: ['Low Stock', 'Out of Stock'] }
      });
      
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} notifications from database`);
      
      // Emit real-time deletion events
      if (req.io) {
        // Emit individual deletion events for each notification
        existingNotifications.forEach(notification => {
          req.io.emit('notification_deleted', { 
            notificationId: notification._id.toString(),
            productId: productId,
            productName: productName,
            type: notification.type,
            notificationHash: notification.notificationHash,
            source: 'stock_service',
            timestamp: new Date().toISOString()
          });
        });
        
        // Emit stock update event
        req.io.emit('stock_updated', {
          productId: productId,
          productName: productName,
          currentStock: currentStock,
          minStock: minStock,
          stockSufficient: true,
          triggerNotification: false,
          alertsRemoved: deleteResult.deletedCount,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📡 Emitted ${existingNotifications.length} deletion events via Socket.IO`);
      }
      
      return res.json({ 
        status: 'alerts_deleted',
        notificationCreated: false,
        deletedCount: deleteResult.deletedCount,
        message: `Stock is sufficient. ${deleteResult.deletedCount} alert(s) removed from database.`,
        currentStock,
        minStock,
        productId,
        productName,
        stockSufficient: true,
        alertsRemoved: deleteResult.deletedCount
      });
    } else {
      console.log(`   ℹ️ No existing alerts found for this product`);
      
      return res.json({ 
        status: 'no_alert_needed',
        notificationCreated: false,
        deletedCount: 0,
        message: 'Stock is sufficient. No alerts needed.',
        currentStock,
        minStock,
        productId,
        productName,
        stockSufficient: true
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking stock:', error);
    res.status(500).json({ error: 'Error checking stock', details: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { 
        isRead: true, 
        lastUpdated: new Date() 
      },
      { new: true }
    );
    
    // Emit update event to all clients
    if (req.io) {
      req.io.emit('notification_updated', {
        notification: updatedNotification,
        action: 'updated',
        oldId: notification._id,
        source: 'notification_page',
        notificationHash: notification.notificationHash,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Error updating notification' });
  }
});

// Resolve notification
router.put('/:id/resolve', async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { 
        isResolved: true,
        isRead: true,
        resolutionNote: resolutionNote || 'Manually resolved',
        resolvedAt: new Date(),
        lastUpdated: new Date()
      },
      { new: true }
    );
    
    // Emit resolved event to all clients
    if (req.io) {
      req.io.emit('notification_resolved', {
        notificationId: notification._id.toString(),
        notificationHash: notification.notificationHash,
        resolutionNote: resolutionNote || 'Manually resolved',
        source: 'notification_page',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error resolving notification:', error);
    res.status(500).json({ error: 'Error resolving notification' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', async (req, res) => {
  try {
    const notifications = await Notification.find({ isResolved: false, isRead: false });
    
    await Notification.updateMany(
      { isResolved: false, isRead: false },
      { 
        isRead: true, 
        lastUpdated: new Date() 
      }
    );
    
    // Emit update events for each notification to all clients
    if (req.io) {
      notifications.forEach(notification => {
        req.io.emit('notification_updated', {
          notification: { ...notification.toObject(), isRead: true },
          action: 'updated',
          oldId: notification._id,
          source: 'notification_page',
          notificationHash: notification.notificationHash,
          timestamp: new Date().toISOString()
        });
      });
    }
    
    res.json({ message: 'All notifications marked as read', updatedCount: notifications.length });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Error updating notifications' });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    
    // Emit real-time deletion event to all clients
    if (req.io) {
      req.io.emit('notification_deleted', { 
        notificationId: notification._id.toString(),
        productId: notification.productId,
        productName: notification.productName,
        type: notification.type,
        notificationHash: notification.notificationHash,
        source: 'notification_page',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Error deleting notification' });
  }
});

// Clear resolved notifications
router.delete('/clear-resolved', async (req, res) => {
  try {
    const resolvedNotifications = await Notification.find({ 
      $or: [
        { isResolved: true },
        { isRead: true }
      ]
    });
    
    const deleteResult = await Notification.deleteMany({ 
      $or: [
        { isResolved: true },
        { isRead: true }
      ]
    });
    
    // Emit deletion events to all clients
    if (req.io) {
      resolvedNotifications.forEach(notification => {
        req.io.emit('notification_deleted', { 
          notificationId: notification._id.toString(),
          productId: notification.productId,
          productName: notification.productName,
          type: notification.type,
          notificationHash: notification.notificationHash,
          source: 'notification_page',
          timestamp: new Date().toISOString()
        });
      });
    }
    
    res.json({ 
      message: 'Resolved notifications cleared', 
      deletedCount: deleteResult.deletedCount 
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Error clearing notifications' });
  }
});

module.exports = router;