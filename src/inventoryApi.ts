export async function getProducts() {
    const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .order('name', { ascending: true });
    if (error) throw error;
    return data;
}

export async function addProduct(product: { name: string, description: string, stock_quantity: number, min_stock_level: number, price_unit: number }) {
    const { error } = await supabaseClient.from('products').insert([product]);
    if (error) throw error;
    return true;
}

export async function updateProductStock(id: string, newQuantity: number) {
    const { error } = await supabaseClient.from('products').update({ stock_quantity: newQuantity }).eq('id', id);
    if (error) throw error;
    return true;
}

export async function deleteProduct(id: string) {
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
}
