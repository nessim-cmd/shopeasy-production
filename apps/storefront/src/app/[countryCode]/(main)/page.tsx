import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import { getRegion } from "@lib/data/regions"
import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import ProductPreview from "@modules/products/components/product-preview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "ShopEasy - Home",
  description:
    "Quality Essentials, Delivered to Your Door.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // Fetch all categories
  const categories = await listCategories()

  // Fetch seeded products (limit to 4)
  const { response: { products } } = await listProducts({
    countryCode,
    queryParams: { limit: 4 },
  })

  return (
    <>
      <Hero />
      <div className="py-12 content-container">
        
        {/* Trust Strip */}
        <div className="flex justify-center items-center gap-x-12 py-12 border-b border-ui-border-base mb-12">
          <span className="text-ui-fg-subtle txt-large">Cash on Delivery</span>
          <span className="text-ui-fg-subtle txt-large">Fast Shipping</span>
          <span className="text-ui-fg-subtle txt-large">Easy Returns</span>
        </div>

        {/* Featured Categories */}
        <div className="mb-16">
          <h2 className="text-2xl-semi mb-8">Featured Categories</h2>
          <ul className="grid grid-cols-2 small:grid-cols-4 gap-4">
            {categories?.map((category) => (
              <li key={category.id}>
                <LocalizedClientLink 
                  href={`/categories/${category.handle}`}
                  className="group flex flex-col items-center justify-center p-8 border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base transition-colors"
                >
                  <span className="txt-large">{category.name}</span>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Featured Products */}
        <div>
          <h2 className="text-2xl-semi mb-8">Featured Products</h2>
          <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-6 gap-y-12">
            {products && products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} isFeatured />
              </li>
            ))}
          </ul>
        </div>

      </div>
    </>
  )
}
