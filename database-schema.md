# TBL_ORDERS Database Structure

## Firebase Realtime Database Schema

```json
{
  "TBL_ORDERS": {
    "john_doe": {
      "ORD-20241215-0001": {
        "orderId": "ORD-20241215-0001",
        "userId": "user123",
        "userEmail": "customer@example.com",
        "userName": "John Doe",
        "status": "pending_payment",
        "createdAt": 1703123456789,
        "updatedAt": 1703123456789,
        
        "items": [
          {
            "productId": "PROD001",
            "name": "Gengar Sleeves",
            "price": 3700,
            "quantity": 1,
            "image": "https://example.com/gengar-sleeves.jpg",
            "isPreOrder": false
          },
          {
            "productId": "PROD002", 
            "name": "Giganotosaurus",
            "price": 3700,
            "quantity": 1,
            "image": "https://example.com/giganotosaurus.jpg",
            "isPreOrder": false
          }
        ],
        
        "totals": {
          "subtotal": 7400,
          "shipping": 50,
          "grandTotal": 7450
        },
        
        "shipping": {
          "type": "delivery",
          "name": "John Doe",
          "address": "123 Main Street",
          "city": "Manila",
          "zip": "1000"
        },
        
        "payment": {
          "method": "gcash",
          "status": "pending",
          "referenceId": "GCASH123456789",
          "proofBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
          "verifiedAt": null,
          "verifiedBy": null
        },
        
        "timeline": [
          {
            "status": "order_created",
            "timestamp": 1703123456789,
            "note": "Order created and awaiting payment"
          },
          {
            "status": "payment_submitted", 
            "timestamp": 1703124000000,
            "note": "Payment proof submitted via GCash"
          }
        ],
        
        "admin": {
          "assignedTo": null,
          "notes": "",
          "lastReviewed": null
        }
      }
    }
  }
}
```

## Status Values

### Order Status
- `pending_payment` - Order created, waiting for payment
- `payment_submitted` - Payment proof uploaded, awaiting verification
- `payment_verified` - Payment confirmed by admin
- `processing` - Order being prepared
- `ready_for_pickup` - Ready for customer pickup
- `shipped` - Order shipped (for delivery)
- `delivered` - Order delivered to customer
- `completed` - Order completed successfully
- `cancelled` - Order cancelled
- `refunded` - Order refunded

### Payment Status
- `pending` - Payment not yet submitted
- `submitted` - Payment proof uploaded
- `verified` - Payment confirmed by admin
- `rejected` - Payment rejected by admin
- `refunded` - Payment refunded

### Shipping Types
- `delivery` - Home delivery
- `pickup` - Store pickup

### Payment Methods
- `cash` - Cash payment (pickup only)
- `credits` - Store credits (pickup only)
- `gcash` - GCash digital wallet
- `maya` - Maya digital wallet

## Key Features

1. **Unique Order IDs**: Format `ORD-YYYYMMDD-XXXX`
2. **User Tracking**: Links to user account
3. **Item Details**: Complete product information
4. **Financial Tracking**: All monetary values
5. **Shipping Information**: Address and delivery details
6. **Payment Tracking**: Method, status, and proof
7. **Timeline**: Complete order history
8. **Admin Management**: Assignment and notes
9. **Timestamps**: Created and updated times
10. **Status Management**: Clear workflow states
