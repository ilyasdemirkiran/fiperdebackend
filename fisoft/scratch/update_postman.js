import fs from 'fs';

const path = 'c:/Users/ilyasdemirkiran/Documents/projects/fiperdebackendmain/fisoft/FiPerde_Backend_Postman_Collection.json';

const raw = fs.readFileSync(path, 'utf8');
const col = JSON.parse(raw);

const authHeader = [
  { "key": "Authorization", "value": "Bearer {{token}}", "type": "text" }
];

const jsonHeader = [
  { "key": "Authorization", "value": "Bearer {{token}}", "type": "text" },
  { "key": "Content-Type", "value": "application/json", "type": "text" }
];

// Helper to find folder
function getFolder(name) {
  let f = col.item.find(i => i.name === name);
  if (!f) {
    f = { name, item: [] };
    col.item.push(f);
  }
  return f;
}

// 1. Company Endpoints
const companyFolder = getFolder('Company');
const newCompanyEndpoints = [
  {
    name: "Get Company Invites",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/invites", host: ["{{base_url}}"], path: ["api", "companies", "invites"] }
    }
  },
  {
    name: "Get My Invites",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/my-invites", host: ["{{base_url}}"], path: ["api", "companies", "my-invites"] }
    }
  },
  {
    name: "Leave Company",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/leave", host: ["{{base_url}}"], path: ["api", "companies", "leave"] }
    }
  },
  {
    name: "Delete Invite",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/invites/:inviteId", host: ["{{base_url}}"], path: ["api", "companies", "invites", ":inviteId"] }
    }
  },
  {
    name: "Promote User to Admin",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/:id/users/:userId/promote", host: ["{{base_url}}"], path: ["api", "companies", ":id", "users", ":userId", "promote"] }
    }
  },
  {
    name: "Demote User from Admin",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/:id/users/:userId/demote", host: ["{{base_url}}"], path: ["api", "companies", ":id", "users", ":userId", "demote"] }
    }
  },
  {
    name: "Remove User from Company",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/:id/users/:userId", host: ["{{base_url}}"], path: ["api", "companies", ":id", "users", ":userId"] }
    }
  },
  {
    name: "Get Company Logo",
    request: {
      method: "GET",
      header: [],
      url: { raw: "{{base_url}}/api/companies/:id/logo/original", host: ["{{base_url}}"], path: ["api", "companies", ":id", "logo", "original"] }
    }
  },
  {
    name: "Upload Company Logo",
    request: {
      method: "POST",
      header: authHeader,
      body: {
        mode: "formdata",
        formdata: [
          { key: "original", type: "file" },
          { key: "mini", type: "file" }
        ]
      },
      url: { raw: "{{base_url}}/api/companies/:id/logo", host: ["{{base_url}}"], path: ["api", "companies", ":id", "logo"] }
    }
  },
  {
    name: "Delete Company Logo",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/companies/:id/logo", host: ["{{base_url}}"], path: ["api", "companies", ":id", "logo"] }
    }
  }
];

newCompanyEndpoints.forEach(ep => {
  if (!companyFolder.item.some(i => i.name === ep.name)) companyFolder.item.push(ep);
});

// 2. Quotes Endpoints
const quotesFolder = getFolder('Quotes');
const newQuoteEndpoints = [
  {
    name: "Get Currency Rates (TCMB)",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/currency/rates", host: ["{{base_url}}"], path: ["api", "quotes", "currency", "rates"] }
    }
  },
  {
    name: "Update Quote Customer",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"customerId\": \"CUSTOMER_ID\",\n  \"customerName\": \"John Doe\"\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/customer", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "customer"] }
    }
  },
  {
    name: "Update Quote Currency",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"currency\": \"USD\"\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/currency", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "currency"] }
    }
  },
  {
    name: "Update Quote Conversions",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"TRY\": 1,\n  \"USD\": 35,\n  \"EUR\": 38\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/conversions", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "conversions"] }
    }
  },
  {
    name: "Update Quote Discount Percent",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"discountPercent\": 10\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/discount", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "discount"] }
    }
  },
  {
    name: "Update Room Name",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"name\": \"Living Room\"\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId"] }
    }
  },
  {
    name: "Delete Room",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId"] }
    }
  },
  {
    name: "Add Custom Item to Room",
    request: {
      method: "POST",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"name\": \"Custom Item\",\n  \"quantity\": 2,\n  \"unitPrice\": 150,\n  \"currency\": \"TRY\"\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId/custom-items", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId", "custom-items"] }
    }
  },
  {
    name: "Update Item in Room",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"quantity\": 3,\n  \"customPrice\": 200\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId/items/:itemId", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId", "items", ":itemId"] }
    }
  },
  {
    name: "Update Item Public Name",
    request: {
      method: "PATCH",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"publicName\": \"Special Fabric Curtain\"\n}" },
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId/items/:itemId/public-name", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId", "items", ":itemId", "public-name"] }
    }
  },
  {
    name: "Delete Item from Room",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/:id/rooms/:roomId/items/:itemId", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "rooms", ":roomId", "items", ":itemId"] }
    }
  },
  {
    name: "Submit Quote for Approval",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/:id/submit", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "submit"] }
    }
  },
  {
    name: "Approve Quote",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/:id/approve", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "approve"] }
    }
  },
  {
    name: "Deny Quote",
    request: {
      method: "POST",
      header: authHeader,
      url: { raw: "{{base_url}}/api/quotes/:id/deny", host: ["{{base_url}}"], path: ["api", "quotes", ":id", "deny"] }
    }
  }
];

newQuoteEndpoints.forEach(ep => {
  if (!quotesFolder.item.some(i => i.name === ep.name)) quotesFolder.item.push(ep);
});

// 3. Vendor Attachments (Vendor Folder)
const vendorFolder = getFolder('Vendors & Price Rates');
const newVendorEndpoints = [
  {
    name: "List Vendor Attachments",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments"] }
    }
  },
  {
    name: "Get Vendor Attachment Metadata",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments/:attachmentId", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments", ":attachmentId"] }
    }
  },
  {
    name: "Preview Vendor Attachment PDF",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments/:attachmentId/preview", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments", ":attachmentId", "preview"] }
    }
  },
  {
    name: "Download Vendor Attachment PDF",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments/:attachmentId/download", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments", ":attachmentId", "download"] }
    }
  },
  {
    name: "Upload Vendor Attachment PDF",
    request: {
      method: "POST",
      header: authHeader,
      body: {
        mode: "formdata",
        formdata: [
          { key: "file", type: "file" },
          { key: "title", value: "Price List 2026", type: "text" }
        ]
      },
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments"] }
    }
  },
  {
    name: "Update Vendor Attachment",
    request: {
      method: "PUT",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"title\": \"Updated Price List\"\n}" },
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments/:attachmentId", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments", ":attachmentId"] }
    }
  },
  {
    name: "Delete Vendor Attachment",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/vendors/:vendorId/attachments/:attachmentId", host: ["{{base_url}}"], path: ["api", "vendors", ":vendorId", "attachments", ":attachmentId"] }
    }
  },
  {
    name: "List Price List Requests",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/price-list-requests", host: ["{{base_url}}"], path: ["api", "price-list-requests"] }
    }
  },
  {
    name: "Submit Price List Request",
    request: {
      method: "POST",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"vendorName\": \"Somfy\",\n  \"companyName\": \"My Store\",\n  \"message\": \"Please update prices\"\n}" },
      url: { raw: "{{base_url}}/api/price-list-requests", host: ["{{base_url}}"], path: ["api", "price-list-requests"] }
    }
  }
];

newVendorEndpoints.forEach(ep => {
  if (!vendorFolder.item.some(i => i.name === ep.name)) vendorFolder.item.push(ep);
});

// 4. Customer Images (Customers Folder)
const customerFolder = getFolder('Customers');
const newCustomerEndpoints = [
  {
    name: "List All Customer Images",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/customers/images", host: ["{{base_url}}"], path: ["api", "customers", "images"] }
    }
  },
  {
    name: "Get Image Metadata",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/customers/images/:imageId", host: ["{{base_url}}"], path: ["api", "customers", "images", ":imageId"] }
    }
  },
  {
    name: "Download Customer Image",
    request: {
      method: "GET",
      header: authHeader,
      url: { raw: "{{base_url}}/api/customers/images/:imageId/download", host: ["{{base_url}}"], path: ["api", "customers", "images", ":imageId", "download"] }
    }
  },
  {
    name: "Upload Image (General)",
    request: {
      method: "POST",
      header: authHeader,
      body: {
        mode: "formdata",
        formdata: [
          { key: "file", type: "file" },
          { key: "labels", value: "label1,label2", type: "text" }
        ]
      },
      url: { raw: "{{base_url}}/api/customers/images", host: ["{{base_url}}"], path: ["api", "customers", "images"] }
    }
  },
  {
    name: "Upload Image for Customer",
    request: {
      method: "POST",
      header: authHeader,
      body: {
        mode: "formdata",
        formdata: [
          { key: "file", type: "file" },
          { key: "labels", value: "bedroom", type: "text" }
        ]
      },
      url: { raw: "{{base_url}}/api/customers/:customerId/images", host: ["{{base_url}}"], path: ["api", "customers", ":customerId", "images"] }
    }
  },
  {
    name: "Filter Images by Labels",
    request: {
      method: "POST",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"labelIds\": [\"LABEL_ID\"]\n}" },
      url: { raw: "{{base_url}}/api/customers/images/by-labels", host: ["{{base_url}}"], path: ["api", "customers", "images", "by-labels"] }
    }
  },
  {
    name: "Update Image Labels",
    request: {
      method: "PUT",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"labels\": [\"newlabel\"]\n}" },
      url: { raw: "{{base_url}}/api/customers/images/:imageId", host: ["{{base_url}}"], path: ["api", "customers", "images", ":imageId"] }
    }
  },
  {
    name: "Delete Customer Image",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/customers/images/:imageId", host: ["{{base_url}}"], path: ["api", "customers", "images", ":imageId"] }
    }
  },
  {
    name: "Update Customer Note",
    request: {
      method: "PUT",
      header: jsonHeader,
      body: { mode: "raw", raw: "{\n  \"note\": \"Updated note text\"\n}" },
      url: { raw: "{{base_url}}/api/customers/:customerId/notes/:noteId", host: ["{{base_url}}"], path: ["api", "customers", ":customerId", "notes", ":noteId"] }
    }
  },
  {
    name: "Delete Customer Note",
    request: {
      method: "DELETE",
      header: authHeader,
      url: { raw: "{{base_url}}/api/customers/:customerId/notes/:noteId", host: ["{{base_url}}"], path: ["api", "customers", ":customerId", "notes", ":noteId"] }
    }
  }
];

newCustomerEndpoints.forEach(ep => {
  if (!customerFolder.item.some(i => i.name === ep.name)) customerFolder.item.push(ep);
});

fs.writeFileSync(path, JSON.stringify(col, null, 2), 'utf8');
console.log('Postman collection updated successfully with all new endpoints!');
