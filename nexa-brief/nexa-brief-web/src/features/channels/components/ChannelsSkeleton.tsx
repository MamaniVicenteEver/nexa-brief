import { cn } from "@/lib/utils";
import { surfaceCard } from "./styles";

const pulse = "animate-pulse rounded-xl bg-nb-line/60";

export function ChannelsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(surfaceCard, "h-[74px] rounded-[18px] p-4")}>
            <div className={cn(pulse, "h-full w-2/3")} />
          </div>
        ))}
      </div>
      <div className={cn(pulse, "h-10 w-full max-w-[420px] rounded-full")} />
      {[0, 1].map((i) => (
        <div key={i} className={cn(surfaceCard, "flex flex-col gap-5 p-6")}>
          <div className={cn(pulse, "h-10 w-48")} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
            {[0, 1, 2].map((j) => (
              <div key={j} className={cn(pulse, "h-[236px] rounded-[18px]")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
