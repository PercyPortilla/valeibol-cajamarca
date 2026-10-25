import { Icon } from "@/components/ui/Icon";
import { getPublicSports } from "@/lib/data/platformService";

export async function PlatformSearchForm({ sport = "", city = "" }: { sport?: string; city?: string }) {
  const sports = await getPublicSports();
  return (
    <form className="platform-search-form" action="/buscar" method="get">
      <label>
        <span><Icon name="ball" size={14} /> Deporte</span>
        <select name="deporte" defaultValue={sport}>
          <option value="">Todos los deportes</option>
          {sports.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
      </label>
      <label>
        <span><Icon name="location" size={14} /> Ciudad</span>
        <input name="ciudad" defaultValue={city} placeholder="Ej. Cajamarca" autoComplete="address-level2" />
      </label>
      <button className="button button--primary" type="submit">Buscar canchas <span aria-hidden="true">→</span></button>
    </form>
  );
}
