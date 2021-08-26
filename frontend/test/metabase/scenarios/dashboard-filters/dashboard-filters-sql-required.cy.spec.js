import { restore, filterWidget } from "__support__/e2e/cypress";
import { SAMPLE_DATASET } from "__support__/e2e/cypress_sample_dataset";

const { PRODUCTS } = SAMPLE_DATASET;

const questionDetails = {
  name: "SQL products category, required, 2 selections",
  native: {
    query: "select * from PRODUCTS where {{filter}}",
    "template-tags": {
      filter: {
        id: "e33dc805-6b71-99a5-ee14-128383953986",
        name: "filter",
        "display-name": "Filter",
        type: "dimension",
        dimension: ["field", PRODUCTS.CATEGORY, null],
        "widget-type": "category",
        default: ["Gizmo", "Gadget"],
        required: true,
      },
    },
  },
};

const filter = {
  name: "Category",
  slug: "category",
  id: "49fcc65c",
  type: "category",
  default: ["Widget"],
};

const dashboardDetails = { parameters: [filter] };

describe("scenarios > dashboard > filters > SQL > required ", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    cy.createNativeQuestionAndDashboard({
      questionDetails,
      dashboardDetails,
    }).then(({ body: dashboardCard }) => {
      const { card_id, dashboard_id } = dashboardCard;

      const mapFilterToCard = {
        parameter_mappings: [
          {
            parameter_id: filter.id,
            card_id,
            target: ["dimension", ["template-tag", "filter"]],
          },
        ],
      };

      cy.editDashboardCard(dashboardCard, mapFilterToCard);

      cy.visit(`/dashboard/${dashboard_id}`);
    });
  });

  it("should respect default filter precedence (dashboard filter, then SQL field filters)", () => {
    // Default dashboard filter
    cy.url().should("contain", "?category=Widget");

    cy.get(".Card")
      .as("dashboardCard")
      .contains("Widget");

    filterWidget().contains("Widget");

    removeWidgetFilterValue();

    cy.url().should("contain", "?category=");

    // SQL question defaults
    cy.get("@dashboardCard").within(() => {
      cy.findAllByText("Gizmo");
      cy.findAllByText("Gadget");
    });

    // Empty filter widget
    filterWidget().contains("Category");

    cy.reload();
  });
});

function removeWidgetFilterValue() {
  filterWidget()
    .find(".Icon-close")
    .click();
}
