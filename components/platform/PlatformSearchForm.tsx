import { sports } from "@/config/sports";

export function PlatformSearchForm({ sport = "", city = "" }: { sport?: string; city?: string }) {
  return (
    <form className="platform-search-form" action="/buscar" method="get">
      <label>
        <span>Deporte</span>
        <select name="deporte" defaultValue={sport}>
          <option value="">Todos los deportes</option>
          {sports.filter((item) => item.active).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
      </label>
      <label>
        <span>Ciudad</span>
        <input name="ciudad" defaultValue={city} placeholder="Ej. Cajamarca" autoComplete="address-level2" />
      </label>
      <button className="button button--primary" type="submit">Buscar canchas</button>
    </form>
  );
}
