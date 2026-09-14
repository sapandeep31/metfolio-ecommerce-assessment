import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  productQuerySchema,
  slugSchema,
  type Category,
  type Product,
  type ProductList,
  type ProductQuery,
} from '@shop/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

/** Public storefront catalog. No auth: this is the shop window. */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @Header('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  listCategories(): Promise<Category[]> {
    return this.catalog.listCategories();
  }

  @Get('products')
  @Header('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  listProducts(
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery,
  ): Promise<ProductList> {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  @Header('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  getProduct(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<Product> {
    return this.catalog.getProductBySlug(slug);
  }
}
