# Aurorus Connect REBORN - Ordering Flow Redesign Prompt

## Project Overview
You are redesigning the complete ordering flow for Aurorus Connect REBORN, a TCG (Trading Card Game) e-commerce platform. The current system has basic cart and checkout functionality, but needs a comprehensive redesign to support multiple payment methods and a proper order management system.

## Current System Analysis
- **Cart Page**: Basic cart with item selection, quantity management, and "Proceed to Checkout" button
- **Checkout Page**: Simple checkout with shipping options (delivery/pickup) and basic payment (GCash/PayMaya)
- **Technology Stack**: HTML, CSS, JavaScript, Firebase (Realtime Database, Storage, Auth)

## New Ordering Flow Requirements

### 1. Cart Page Enhancements
**Current**: Basic cart with "Proceed to Checkout" button
**New Requirements**:
- Keep existing cart functionality (item selection, quantity management)
- "Proceed to Checkout" button should redirect to a new **Order Review Page**
- Cart should show selected items with clear pricing breakdown

### 2. Order Review Page (New)
**Purpose**: Review order details before payment method selection
**Features**:
- Display all selected items with quantities and prices
- Show order summary (subtotal, shipping, total)
- Display shipping information (delivery address or pickup location)
- **"Proceed to Payment" button** - redirects to payment method selection

### 3. Payment Method Selection (New)
**Purpose**: Choose payment method and handle different payment flows
**Payment Options**:
- **Cash (In-Store)**: For store pickup orders
- **Store Credits (In-Store)**: For customers with store credit balance
- **GCash**: Digital wallet payment
- **Maya**: Digital wallet payment

**Flow Logic**:
- **Cash/Store Credits**: Order becomes "Pending" immediately after selection
- **GCash/Maya**: Redirect to dedicated payment page with QR code

### 4. Digital Payment Page (New)
**Purpose**: Handle GCash and Maya payments
**Features**:
- Display QR code image for the selected payment method
- **Upload Screenshot** functionality for payment proof
- **Reference ID** input field
- **Submit Payment Proof** button
- After submission: Order status becomes "Pending"

### 5. Order Status Management
**Order States**:
- **Pending**: Order submitted, awaiting payment verification (for digital payments) or awaiting pickup (for cash/store credits)
- **Confirmed**: Payment verified, order being processed
- **Shipped**: Order dispatched (for delivery)
- **Ready for Pickup**: Order ready at store (for pickup)
- **Completed**: Order fulfilled
- **Cancelled**: Order cancelled

## Technical Implementation Requirements

### File Structure Changes
```
├── cart.html (enhanced)
├── order-review.html (new)
├── payment-method.html (new)
├── payment-digital.html (new)
├── order-confirmation.html (new)
└── js/
    ├── cart.js (enhanced)
    ├── order-review.js (new)
    ├── payment-method.js (new)
    ├── payment-digital.js (new)
    └── order-management.js (new)
```

### Database Schema Updates
**TBL_ORDERS** structure:
```javascript
{
  orderId: "ORD-20241201-1234",
  uid: "user_id",
  createdAt: timestamp,
  items: [
    {
      productId: "prod_123",
      name: "Product Name",
      price: 100,
      quantity: 2,
      image: "base64_image"
    }
  ],
  totals: {
    subtotal: 200,
    shipping: 0,
    grandTotal: 200
  },
  shipping: {
    type: "delivery|pickup",
    name: "Customer Name",
    address: "Full Address",
    city: "City",
    zip: "ZIP Code"
  },
  payment: {
    method: "cash|store_credits|gcash|maya",
    refNumber: "reference_id",
    proofUrl: "firebase_storage_url",
    qrCodeUrl: "qr_code_image_url"
  },
  status: "pending|confirmed|shipped|ready_for_pickup|completed|cancelled",
  statusHistory: [
    {
      status: "pending",
      timestamp: timestamp,
      note: "Order submitted"
    }
  ]
}
```

### Key Features to Implement

#### 1. Enhanced Cart Page
- Maintain existing functionality
- Add order summary preview
- Improve "Proceed to Checkout" button styling and validation

#### 2. Order Review Page
- Display complete order details
- Allow editing of shipping information
- Show final pricing breakdown
- "Proceed to Payment" button with validation

#### 3. Payment Method Selection
- Radio button selection for payment methods
- Dynamic form fields based on selection
- Validation for required fields
- Redirect logic based on payment method

#### 4. Digital Payment Page
- QR code display (static images for now)
- File upload for payment screenshots
- Reference ID input with validation
- Image preview functionality
- Submit button with loading states

#### 5. Order Confirmation
- Order ID display
- Payment method confirmation
- Next steps information
- Link to order tracking

### UI/UX Requirements
- **Consistent Design**: Use existing CSS framework and design patterns
- **Mobile Responsive**: Ensure all new pages work on mobile devices
- **Loading States**: Show loading indicators during form submissions
- **Error Handling**: Clear error messages and validation feedback
- **Success Feedback**: Toast notifications and confirmation messages
- **Navigation**: Clear breadcrumb navigation between steps

### Firebase Integration
- **Realtime Database**: Store orders and update status in real-time
- **Storage**: Handle payment proof image uploads
- **Auth**: Maintain user authentication throughout the flow
- **Security Rules**: Ensure proper data access controls

### Validation Requirements
- **Cart**: At least one item selected
- **Order Review**: Complete shipping information
- **Payment Method**: Valid selection made
- **Digital Payment**: Screenshot uploaded and reference ID provided
- **Stock Check**: Verify product availability before order confirmation

### Error Handling
- **Network Issues**: Retry mechanisms and offline handling
- **Payment Failures**: Clear error messages and retry options
- **Stock Issues**: Real-time stock validation
- **File Upload**: Handle upload failures gracefully

## Implementation Priority
1. **Phase 1**: Create Order Review Page and Payment Method Selection
2. **Phase 2**: Implement Digital Payment Page with QR codes
3. **Phase 3**: Add Order Status Management and Tracking
4. **Phase 4**: Enhance UI/UX and add advanced features

## Success Criteria
- Users can complete the full ordering flow from cart to payment
- All payment methods work correctly with proper status updates
- Orders are properly tracked and managed
- Mobile experience is smooth and intuitive
- Error handling is comprehensive and user-friendly

## Notes
- Maintain backward compatibility with existing cart functionality
- Use existing Firebase configuration and authentication system
- Follow current code patterns and styling conventions
- Ensure all new pages integrate seamlessly with the existing navigation
- Test thoroughly on both desktop and mobile devices

This redesign will transform the basic checkout into a comprehensive, user-friendly ordering system that supports multiple payment methods and provides clear order tracking throughout the entire process.





