export const projectConfig = {
  businessName: "My Business",
  businessDescription: "Your business description",
  taxRate: 0.0775,   // 7.75%
  currency: "USD",   // manual edit only

  orderStates: {
    awaitingPayment: true,   // "Awaiting Payment"
    inProgress: true,             // "In Progress"
    readyForPickup: true,     // "Ready for Pickup"
    paymentNeeded: true,       // "Payment Needed"
  },
} as const
