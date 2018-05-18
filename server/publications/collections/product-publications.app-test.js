/* eslint dot-notation: 0 */
/* eslint prefer-arrow-callback:0 */
import { Random } from "meteor/random";
import { expect } from "meteor/practicalmeteor:chai";
import { sinon } from "meteor/practicalmeteor:sinon";
import { Roles } from "meteor/alanning:roles";
import { createActiveShop } from "/server/imports/fixtures/shops";
import { Reaction } from "/server/api";
import * as Collections from "/lib/collections";
import Fixtures from "/server/imports/fixtures";
import { PublicationCollector } from "meteor/johanbrook:publication-collector";
import { RevisionApi } from "/imports/plugins/core/revisions/lib/api/revisions";

Fixtures();

describe("Publication", function () {
  let shopId;
  let merchantShopId;
  let primaryShopId;
  let sandbox;

  let merchantShop1ProductIds;
  let merchantShop2ProductIds;
  let primaryShopProductIds;
  let allProductIds;
  let activeMerchantProductIds;

  const productScrollLimit = 24;

  beforeEach(function () {
    shopId = Random.id();
    merchantShopId = Random.id();
    primaryShopId = Random.id();

    sandbox = sinon.sandbox.create();
    sandbox.stub(RevisionApi, "isRevisionControlEnabled", () => true);
    sandbox.stub(Reaction, "getPrimaryShopId", () => primaryShopId);

    Collections.Shops.remove({});

    // muting some shop creation hook behavior (to keep output clean)
    sandbox.stub(Reaction, "setShopName");
    sandbox.stub(Reaction, "setDomain");

    createActiveShop({ _id: shopId, shopType: "merchant" });
    createActiveShop({ _id: merchantShopId, shopType: "merchant" });
    createActiveShop({ _id: primaryShopId, shopType: "primary" });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("with products", function () {
    let collector;

    const priceRangeA = {
      range: "1.00 - 12.99",
      min: 1.00,
      max: 12.99
    };

    const priceRangeB = {
      range: "12.99 - 19.99",
      min: 12.99,
      max: 19.99
    };

    beforeEach(function () {
      Collections.Products.remove({});

      // a product with price range A, and not visible
      const productId1 = Collections.Products.insert({
        ancestors: [],
        title: "My Little Pony",
        shopId,
        type: "simple",
        price: priceRangeA,
        isVisible: false,
        isLowQuantity: false,
        isSoldOut: false,
        isBackorder: false
      });
      // a product with price range B, and visible
      const productId2 = Collections.Products.insert({
        ancestors: [],
        title: "Shopkins - Peachy",
        shopId,
        price: priceRangeB,
        type: "simple",
        isVisible: true,
        isLowQuantity: false,
        isSoldOut: false,
        isBackorder: false
      });
      // a product with price range A, and visible
      const productId3 = Collections.Products.insert({
        ancestors: [],
        title: "Fresh Tomatoes",
        shopId,
        price: priceRangeA,
        type: "simple",
        isVisible: true,
        isLowQuantity: false,
        isSoldOut: false,
        isBackorder: false
      });
      // a product for an unrelated marketplace shop
      const productId4 = Collections.Products.insert({
        ancestors: [],
        title: "Teddy Ruxpin",
        shopId: merchantShopId,
        type: "simple",
        price: priceRangeA,
        isVisible: true,
        isLowQuantity: false,
        isSoldOut: false,
        isBackorder: false
      });
      // a product for the Primary Shop
      const productId5 = Collections.Products.insert({
        ancestors: [],
        title: "Garbage Pail Kids",
        shopId: primaryShopId,
        type: "simple",
        price: priceRangeA,
        isVisible: true,
        isLowQuantity: false,
        isSoldOut: false,
        isBackorder: false
      });

      merchantShop1ProductIds = [productId1, productId2, productId3];
      merchantShop2ProductIds = [productId4];
      primaryShopProductIds = [productId5];
      allProductIds = [productId1, productId2, productId3, productId4, productId5];
      activeMerchantProductIds = [productId2, productId3, productId4];

      collector = new PublicationCollector({ userId: Random.id() });
    });

    describe("Products", function () {
      it("should return all products to admins in the Primary Shop", function (done) {
        // setup
        sandbox.stub(Reaction, "getShopId", () => primaryShopId);
        sandbox.stub(Roles, "userIsInRole", () => true);
        sandbox.stub(Reaction, "hasPermission", () => true);
        sandbox.stub(Reaction, "getShopsWithRoles", () => [shopId, merchantShopId, primaryShopId]);

        collector.collect("Products", 24, undefined, {}, (collections) => {
          const productIds = collections.Products.map(p => p._id);

          expect(productIds).to.have.members(allProductIds);
        }).then((_collections) => done(), done);
      });

      it("should return all products from the current shop to admins in a Merchant Shop", function (done) {
        // setup
        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => true);
        sandbox.stub(Reaction, "hasPermission", () => true);
        sandbox.stub(Reaction, "getShopsWithRoles", () => [shopId, merchantShopId, primaryShopId]);

        // let isDone = false;

        collector.collect("Products", 24, undefined, {}, (collections) => {
          const productIds = collections.Products.map(p => p._id);

          expect(productIds).to.have.members(merchantShop1ProductIds);
        }).then((_collections) => done(), done);
      });

      it("returns products from only the shops for which an admin has createProduct Role", function (done) {
        // setup
        sandbox.stub(Reaction, "getShopId", () => primaryShopId);
        sandbox.stub(Roles, "userIsInRole", () => true);
        sandbox.stub(Reaction, "hasPermission", () => true);
        sandbox.stub(Reaction, "getShopsWithRoles", () => [shopId]);

        collector.collect("Products", 24, undefined, {}, (collections) => {
          const productIds = collections.Products.map(p => p._id);

          expect(productIds).to.have.members(merchantShop1ProductIds);
        }).then((_collections) => done(), done);
      });

      it("should have an expected product title", function (done) {
        // setup
        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => true);
        sandbox.stub(Reaction, "hasPermission", () => true);
        sandbox.stub(Reaction, "getShopsWithRoles", () => [shopId]);

        collector.collect("Products", 24, undefined, {}, (collections) => {
          const products = collections.Products;
          const data = products[1];
          const expectedTitles = ["My Little Pony", "Shopkins - Peachy"];

          expect(expectedTitles.some((title) => title === data.title)).to.be.ok;
        }).then((_collections) => done(), done);
      });

      it("should return only visible products to visitors", function (done) {
        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", 24, undefined, {}, (collections) => {
          const products = collections.Products;
          const data = products[0];
          const expectedTitles = ["Fresh Tomatoes", "Shopkins - Peachy"];

          expect(products.length).to.equal(2);
          expect(expectedTitles.some((title) => title === data.title)).to.be.ok;
        }).then((_collections) => done(), done);
      });

      it("should return only products matching query", function (done) {
        const filters = { query: "Shopkins" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;
          const data = products[0];

          expect(data.title).to.equal("Shopkins - Peachy");
        }).then((_collections) => done(), done);
      });

      it("should not return products not matching query", function (done) {
        const filters = { query: "random search" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;

          expect(products.length).to.equal(0);
        }).then((_collections) => done(), done);
      });

      it("should return products in price.min query", function (done) {
        const filters = { "price.min": "2.00" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;

          expect(products.length).to.equal(1);
        }).then((_collections) => done(), done);
      });

      it("should return products in price.max query", function (done) {
        const filters = { "price.max": "24.00" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;

          expect(products.length).to.equal(2);
        }).then((_collections) => done(), done);
      });

      it("should return products in price.min - price.max range query", function (done) {
        const filters = { "price.min": "12.00", "price.max": "19.98" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;

          expect(products.length).to.equal(2);
        }).then((_collections) => done(), done);
      });

      it("should return products where value is in price set query", function (done) {
        const filters = { "price.min": "13.00", "price.max": "24.00" };

        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const products = collections.Products;

          expect(products.length).to.equal(1);
        }).then((_collections) => done(), done);
      });

      it("should return products from all shops when multiple shops are provided", function (done) {
        const filters = { shops: [shopId, merchantShopId] };

        sandbox.stub(Reaction, "getShopId", () => primaryShopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Products", productScrollLimit, filters, {}, (collections) => {
          const productIds = collections.Products.map(p => p._id);

          expect(productIds).to.have.members(activeMerchantProductIds);
        }).then((_collections) => done(), done);
      });
    });

    describe("Product", function () {
      it("should return a product based on an id", function (done) {
        const product = Collections.Products.findOne({
          isVisible: true
        });
        sandbox.stub(Reaction, "getShopId", () => shopId);

        collector.collect("Product", product._id, (collections) => {
          const products = collections.Products;
          const data = products[0];

          expect(data.title).to.equal(product.title);
        }).then((_collections) => done(), done);
      });

      it("should not return a product if handle does not match exactly", function (done) {
        sandbox.stub(Reaction, "getShopId", () => shopId);

        collector.collect("Product", "shopkins", (collections) => {
          const products = collections.Products;
          if (products) {
            expect(products.length).to.equal(0);
          } else {
            expect(products).to.be.undefined;
          }
        }).then((_collections) => done(), done);
      });

      it("should not return a product based on exact handle match if it isn't visible", function (done) {
        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => false);

        collector.collect("Product", "my-little-pony", (collections) => {
          const products = collections.Products;
          if (products) {
            expect(products.length).to.equal(0);
          } else {
            expect(products).to.be.undefined;
          }
        }).then((_collections) => done(), done);
      });

      it("should return a product to admin based on a exact handle match even if it isn't visible", function (done) {
        sandbox.stub(Reaction, "getShopId", () => shopId);
        sandbox.stub(Roles, "userIsInRole", () => true);
        sandbox.stub(Reaction, "hasPermission", () => true);

        collector.collect("Product", "my-little-pony", (collections) => {
          const products = collections.Products;
          const data = products[0];

          expect(data.title).to.equal("My Little Pony");
        }).then((_collections) => done(), done);
      });
    });
  });
});
