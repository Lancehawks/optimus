import { memo } from "react";
import { Building2, CalendarClock, Flag, NotebookPen, Target, TrendingUp, UsersRound } from "lucide-react";
import { BuildingDayStation } from "../stations/BuildingDayStation";
import { LeadsStation } from "../stations/LeadsStation";
import { MilestonesStation } from "../stations/MilestonesStation";
import { NotesStation } from "../stations/NotesStation";
import { SalesStation } from "../stations/SalesStation";
import { TargetsStation } from "../stations/TargetsStation";

export const MAIN_GOAL_AREA = "main-goal";

// One entry per room area drives both the side menu and the scroll zones.
// Stations are memoized: the room re-renders on every scroll-spy change.
export const ROOM_AREAS = [
  { id: MAIN_GOAL_AREA, label: "Main goal", title: "Main goal countdown", Icon: CalendarClock },
  { id: "building-day", label: "Building day", title: "Day of building", Icon: Building2, Station: memo(BuildingDayStation) },
  { id: "milestones", label: "Milestones", title: "Company milestones", Icon: Flag, Station: memo(MilestonesStation) },
  { id: "targets", label: "Targets", title: "Company targets", Icon: Target, Station: memo(TargetsStation) },
  { id: "sales", label: "Sales", title: "Sales overview", Icon: TrendingUp, Station: memo(SalesStation) },
  { id: "leads", label: "Leads", title: "Client lead sheet", Icon: UsersRound, Station: memo(LeadsStation) },
  { id: "notes", label: "Notes", title: "Founder notes", Icon: NotebookPen, Station: memo(NotesStation) },
];

export const STATION_AREAS = ROOM_AREAS.filter((area) => area.Station);
