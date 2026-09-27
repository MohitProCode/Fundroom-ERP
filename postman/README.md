# Fundroom ERP Postman Tests

Import both files into Postman:

- `Fundroom-ERP.postman_collection.json`
- `Fundroom-ERP.postman_environment.json`

Select the `Fundroom ERP - Local` environment and run the collection with the Postman Collection Runner. Requests are ordered and use test scripts to capture login tokens, product/customer IDs, enquiry ID, quotation ID, and sales order ID automatically.

Start the API first:

```bash
cd apps/api
npm run dev
```

The collection covers health, admin and sales login, enquiry creation, quotation total validation, quotation approval, sales-order conversion, duplicate conversion rejection, unauthorized dispatch rejection, inventory reservation during confirmation, and dispatch creation.

For command-line execution with Newman:

```bash
npx newman run postman/Fundroom-ERP.postman_collection.json \
  -e postman/Fundroom-ERP.postman_environment.json
```

The default credentials come from the development seed. Change them in the environment before using another database.
