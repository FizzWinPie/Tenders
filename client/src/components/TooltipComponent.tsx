import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export default function TooltipComponent({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger><Info size={12} color="gray" /></TooltipTrigger>
      <TooltipContent>
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}
