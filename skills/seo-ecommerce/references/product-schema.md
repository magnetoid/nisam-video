# Product Structured Data Reference

Google uses `Product` and `ProductGroup` schema to display price, availability, and review rich results in search. Use these templates to ensure proper syntax.

## Single Product Template

Use this when the product has no variations (e.g., one size, one color).

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Executive Leather Briefcase",
  "image": [
    "https://example.com/photos/1x1/photo.jpg",
    "https://example.com/photos/4x3/photo.jpg",
    "https://example.com/photos/16x9/photo.jpg"
  ],
  "description": "Premium leather briefcase with compartments for laptops up to 15 inches.",
  "sku": "0446310786",
  "mpn": "925872",
  "brand": {
    "@type": "Brand",
    "name": "ACME"
  },
  "review": {
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "4",
      "bestRating": "5"
    },
    "author": {
      "@type": "Person",
      "name": "Jane Doe"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.4",
    "reviewCount": "89"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/briefcase",
    "priceCurrency": "USD",
    "price": "199.99",
    "priceValidUntil": "2025-12-31",
    "itemCondition": "https://schema.org/NewCondition",
    "availability": "https://schema.org/InStock",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "5.00",
        "currency": "USD"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "US"
      }
    }
  }
}
</script>
```

## ProductGroup Template (for Variants)

Use this when a product comes in multiple variations (e.g., sizes, colors). The `ProductGroup` is the parent, and it contains an array of `hasVariant` products.

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "ProductGroup",
  "name": "Classic Cotton T-Shirt",
  "description": "A comfortable 100% cotton t-shirt available in multiple sizes and colors.",
  "brand": {
    "@type": "Brand",
    "name": "ApparelCo"
  },
  "productGroupID": "T-SHIRT-CLASSIC",
  "variesBy": ["https://schema.org/size", "https://schema.org/color"],
  "hasVariant": [
    {
      "@type": "Product",
      "name": "Classic Cotton T-Shirt - Blue, Medium",
      "sku": "TSHIRT-BLU-M",
      "image": "https://example.com/images/tshirt-blue-m.jpg",
      "color": "Blue",
      "size": "Medium",
      "offers": {
        "@type": "Offer",
        "url": "https://example.com/t-shirt?color=blue&size=m",
        "priceCurrency": "USD",
        "price": "15.99",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "Product",
      "name": "Classic Cotton T-Shirt - Red, Large",
      "sku": "TSHIRT-RED-L",
      "image": "https://example.com/images/tshirt-red-l.jpg",
      "color": "Red",
      "size": "Large",
      "offers": {
        "@type": "Offer",
        "url": "https://example.com/t-shirt?color=red&size=l",
        "priceCurrency": "USD",
        "price": "15.99",
        "availability": "https://schema.org/OutOfStock"
      }
    }
  ]
}
</script>
```

*Source: [Google Search Central: Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)*
