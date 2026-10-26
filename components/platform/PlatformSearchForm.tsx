import { Icon } from "@/components/ui/Icon";
import { getPublicSports } from "@/lib/data/platformService";
import { platformConfig } from "@/config/platform";

export async function PlatformSearchForm({ sport = "", date = "", time = "" }: { sport?: string; city?: string; date?: string; time?: string }) {
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
      <label>
        <span><Icon name="calendar" size={14} /> Fecha</span>
        <input name="fecha" type="date" defaultValue={date} />
      </label>
      <label>
        <span><Icon name="clock" size={14} /> Hora</span>
        <input name="hora" type="time" defaultValue={time} />
      </label>
      <button className="button button--primary" type="submit">Explorar espacios <span aria-hidden="true">→</span></button>
    </form>
  );
}
