import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { itensConferencia as ItensType } from "@/lib/data/case-atesto";

export function ConferenciaTable({ itens }: { itens: typeof ItensType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">conferir-nf-contra-empenho</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd. empenho</TableHead>
              <TableHead className="text-right">Qtd. NF</TableHead>
              <TableHead className="text-right">Valor unit.</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <TableRow key={item.item}>
                <TableCell className="font-medium">{item.item}</TableCell>
                <TableCell className="text-right tabular-nums">{item.qtdEmpenho}</TableCell>
                <TableCell className="text-right tabular-nums">{item.qtdNf}</TableCell>
                <TableCell className="text-right tabular-nums">{item.valorUnit}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      item.status === "ok" ? "text-success" : "text-warning",
                    )}
                  >
                    {item.status === "ok" ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                    {item.status === "ok" ? "Confere" : "Divergência"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
