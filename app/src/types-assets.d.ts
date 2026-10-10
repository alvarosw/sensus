// Módulos binários importados via require() retornam o id do asset (Expo).
declare module '*.db' {
  const assetId: number;
  export default assetId;
}
