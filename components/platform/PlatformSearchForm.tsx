import { Icon } from "@/components/ui/Icon";
import { getPublicSports } from "@/lib/data/platformService";
import { platformConfig } from "@/config/platform";

export async function PlatformSearchForm({ sport = "" }: { sport?: string; city?: string }) {
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
        <input name="ciudad" value={platformConfig.city} readOnly aria-readonly="true" />
      </label>
      <button className="button button--primary" type="submit">Buscar canchas <span aria-hidden="true">→</span></button>
    </form>
  );
}
