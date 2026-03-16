import { db, tablesTable, categoriesTable, menuItemsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  const existingCategories = await db.select().from(categoriesTable);
  if (existingCategories.length > 0) {
    console.log("Database already seeded, skipping...");
    process.exit(0);
  }

  const insertedCategories = await db
    .insert(categoriesTable)
    .values([
      { name: "Bebidas", icon: "cafe", sortOrder: 1 },
      { name: "Entradas", icon: "restaurant", sortOrder: 2 },
      { name: "Pratos Principais", icon: "local-dining", sortOrder: 3 },
      { name: "Sobremesas", icon: "cake", sortOrder: 4 },
    ])
    .returning();

  const catMap = Object.fromEntries(insertedCategories.map((c) => [c.name, c.id]));

  await db.insert(menuItemsTable).values([
    { name: "Água Mineral", description: "Água mineral sem gás 500ml", price: "4.00", categoryId: catMap["Bebidas"], preparationTime: 1, available: true },
    { name: "Suco de Laranja", description: "Suco natural de laranja 300ml", price: "9.00", categoryId: catMap["Bebidas"], preparationTime: 5, available: true },
    { name: "Refrigerante", description: "Lata 350ml - Coca-Cola, Guaraná ou Sprite", price: "6.00", categoryId: catMap["Bebidas"], preparationTime: 1, available: true },
    { name: "Cerveja Artesanal", description: "Long neck 355ml", price: "14.00", categoryId: catMap["Bebidas"], preparationTime: 2, available: true },
    { name: "Vinho da Casa", description: "Taça de vinho tinto ou branco", price: "22.00", categoryId: catMap["Bebidas"], preparationTime: 2, available: true },

    { name: "Pão de Alho", description: "Pão artesanal com manteiga de alho e ervas", price: "12.00", categoryId: catMap["Entradas"], preparationTime: 10, available: true },
    { name: "Ceviche", description: "Peixe marinado no limão com coentro e pimenta", price: "28.00", categoryId: catMap["Entradas"], preparationTime: 15, available: true },
    { name: "Bruschetta", description: "Tomate, manjericão e azeite em fatias de ciabatta", price: "18.00", categoryId: catMap["Entradas"], preparationTime: 8, available: true },
    { name: "Bolinho de Bacalhau", description: "Porção com 8 bolinhos crocantes", price: "32.00", categoryId: catMap["Entradas"], preparationTime: 12, available: true },

    { name: "Picanha na Brasa", description: "350g de picanha com farofa, vinagrete e arroz", price: "68.00", categoryId: catMap["Pratos Principais"], preparationTime: 25, available: true },
    { name: "Salmão Grelhado", description: "Filé de salmão com legumes salteados e purê de batata-doce", price: "72.00", categoryId: catMap["Pratos Principais"], preparationTime: 20, available: true },
    { name: "Frango à Parmegiana", description: "Filé grelhado com molho de tomate, queijo e presunto, acompanha arroz e batata frita", price: "48.00", categoryId: catMap["Pratos Principais"], preparationTime: 22, available: true },
    { name: "Risoto de Cogumelos", description: "Arbório com mix de cogumelos, parmesão e trufas", price: "58.00", categoryId: catMap["Pratos Principais"], preparationTime: 25, available: true },
    { name: "Hambúrguer Artesanal", description: "180g de blend bovino, cheddar, bacon crocante e molho especial no brioche", price: "42.00", categoryId: catMap["Pratos Principais"], preparationTime: 18, available: true },

    { name: "Petit Gâteau", description: "Bolo quente de chocolate com sorvete de creme", price: "24.00", categoryId: catMap["Sobremesas"], preparationTime: 12, available: true },
    { name: "Pudim de Leite", description: "Pudim tradicional com calda de caramelo", price: "16.00", categoryId: catMap["Sobremesas"], preparationTime: 5, available: true },
    { name: "Sorvete Artesanal", description: "3 bolas com cobertura à escolha", price: "18.00", categoryId: catMap["Sobremesas"], preparationTime: 5, available: true },
  ]);

  await db.insert(tablesTable).values([
    { number: 1, capacity: 2, status: "available" },
    { number: 2, capacity: 4, status: "available" },
    { number: 3, capacity: 4, status: "available" },
    { number: 4, capacity: 6, status: "available" },
    { number: 5, capacity: 6, status: "available" },
    { number: 6, capacity: 8, status: "available" },
    { number: 7, capacity: 2, status: "available" },
    { number: 8, capacity: 4, status: "available" },
    { number: 9, capacity: 4, status: "available" },
    { number: 10, capacity: 8, status: "available" },
    { number: 11, capacity: 2, status: "available" },
    { number: 12, capacity: 6, status: "available" },
  ]);

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
