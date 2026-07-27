// ---------------------------------------------------------------------------
// GEOGRAFIA REAL DO RIO GRANDE DO SUL
//
// Coordenadas reais (lat, long) da Reitoria (Santa Maria) e dos 13 campi,
// projetadas em um plano (x, z) equirretangular centrado na região onde o
// IFFar atua. O contorno do estado (RS_OUTLINE) vem do shapefile público do
// IBGE (via github.com/giuliano-macedo/geodata-br-states), simplificado por
// Douglas-Peucker e projetado com a mesma transformação — por isso os
// prédios caem no lugar geograficamente certo dentro do contorno real do RS,
// não em posições arbitrárias. x = longitude projetada, z = latitude
// projetada (z cresce para o sul, então o norte já fica para cima).
// ---------------------------------------------------------------------------

// nome (sem "Campus ") -> posição real no plano (lat/long projetadas com
// centro em -28.5715,-55.2411 e escala 10.29 un/grau de longitude,
// 11.55 un/grau de latitude — a mesma transformação usada no contorno)
export const RS_CITY_COORDS: Record<string, [number, number]> = {
  Reitoria: [14.83, 12.84],
  Alegrete: [-5.66, 14.0],
  "Frederico Westphalen": [19.0, -14.0],
  Jaguari: [5.67, 10.69],
  "Júlio de Castilhos": [16.04, 7.57],
  Panambi: [17.9, -3.22],
  "Santa Rosa": [7.82, -8.09],
  Santiago: [3.85, 7.16],
  "Santo Augusto": [15.06, -8.32],
  "Santo Ângelo": [10.2, -3.33],
  "São Borja": [-7.85, 1.03],
  "São Luiz Gonzaga": [2.88, -1.89],
  "São Vicente do Sul": [5.91, 13.03],
  Uruguaiana: [-19.0, 13.67],
};

// Contorno simplificado do RS (76 pontos), mesma projeção acima. Inclui a
// restinga litorânea — por isso a Lagoa dos Patos aparece naturalmente como
// água "dentro" do desenho do estado.
export const RS_OUTLINE: [number, number][] = [
  [56.89, 8.71], [45.98, 29.36], [32.56, 41.7], [33.2, 38.89], [32.2, 37.21],
  [34.87, 38.06], [40.92, 33.59], [41.93, 28.76], [46.7, 25.11], [46.54, 20.56],
  [48.01, 22.06], [47.79, 18.75], [44.36, 21.53], [40.59, 16.5], [40.61, 20.01],
  [42.66, 20.71], [40.56, 22.95], [40.73, 25.88], [39.89, 23.81], [39.1, 29.06],
  [34.05, 31.75], [33.03, 36.04], [31.02, 36.73], [30.77, 38.15], [31.98, 38.71],
  [32.18, 38.94], [32.18, 39.08], [31.8, 38.76], [31.1, 39.13], [30.79, 40.19],
  [32.03, 39.12], [32.49, 41.72], [30.19, 43.77], [26.87, 52.48], [18.97, 59.83],
  [17.54, 58.64], [18.67, 52.76], [20.36, 52.41], [21.75, 48.76], [25.62, 49.55],
  [27.32, 45.68], [26.94, 41.26], [22.19, 47.19], [19.06, 46.38], [15.39, 40.51],
  [6.74, 33.32], [0.02, 31.06], [-3.47, 26.12], [-7.91, 28.99], [-8.05, 25.58],
  [-16.1, 17.71], [-18.82, 17.5], [-20.34, 19.85], [-24.72, 18.73], [-12.11, 5.82],
  [-6.54, -2.42], [-4.69, -1.68], [-5.46, -3.79], [2.12, -8.23], [4.38, -11.98],
  [9.85, -12.98], [14.04, -16.69], [16.45, -15.6], [19.21, -17.1], [19.86, -15.63],
  [22.76, -17.22], [23.29, -15.59], [31.63, -14.99], [42.73, -8.54], [47.49, -2.08],
  [56.34, -1.29], [57.08, 0.62], [54.59, 1.81], [54.31, 6.31], [52.12, 7.83],
  [56.89, 8.71],
];

export function cityKeyFromName(nome: string): string {
  return nome.replace(/^Campus\s+/i, "").trim();
}
