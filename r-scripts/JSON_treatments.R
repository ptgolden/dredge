#!/usr/bin/env Rscript

# Install packages
if(!"optparse" %in% installed.packages()){
    install.packages("optparse", repos = "http://cran.us.r-project.org")
}
library("optparse")

# Define options and usage
option_list = list(
    make_option(c("-i", "--inDesign"), type="character", default=NULL, 
                help="path to experimental design data frame input file", metavar="character"),
    make_option(c("-o", "--outJSON"), type="character", default="treatments.json",  
                help="name of JSON output file", metavar="character")
)
opt_parser = OptionParser(option_list=option_list, usage = "\n\tAccepts an experiment design table and converts it to a JSON file.\n\tInput file must include \"treament.id\", \"treatment.name\", and \"replicate.id\" columns.\n\n\tExample: Rscript JSON_treatments.R -i design_in.tsv -o design_out.json\n")
opt = parse_args(opt_parser)

# Define converstion function
convertDesignToJSON <- function(design = opt$inDesign, outJSON = opt$outJSON){

    if(!"jsonlite" %in% installed.packages()){
        install.packages("jsonlite")
    }
    library("jsonlite")
    
    expDesign <- read.csv(design, header = T, sep = "\t", stringsAsFactors = F)
    
    if(length(setdiff(c("treatment.id", "treatment.name", "replicate.id"), colnames(expDesign)))>0){
        return("Error: Design file must include the following columns: 'treatment.id', 'treatment.name', and 'replicate.id'.")
    }
    allTreatments <- unique(expDesign[,"treatment.id"])
    expList <- list()
    for(treatmentID in allTreatments){
        treatmentName <- unique(expDesign[which(expDesign$treatment.id==treatmentID),"treatment.name"])[1]
        treatmentReplicates <- expDesign[which(expDesign$treatment.id==treatmentID), "replicate.id"]
        expList[treatmentID] <- list(c(
            "label" = treatmentName,
            "replicates" = list(treatmentReplicates)
        ))
    }

    expJSON = toJSON(expList, pretty = T)
    write(expJSON, file = outJSON)
}

# Convert
convertDesignToJSON()
if(length(warnings())>0){
    print(warnings())
}

